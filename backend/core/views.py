"""
core/views.py
All API views for Shabiki Aviator Platform.
"""
import uuid
import logging
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from django.db import transaction as db_transaction
from django.db.models import Sum, Count, Q
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User, GameRound, Bet, Transaction, ChatMessage, PlatformSettings
from .serializers import (
    RegisterSerializer, CustomTokenObtainPairSerializer, UserSerializer,
    GameRoundSerializer, GameRoundListSerializer, BetSerializer, PlaceBetSerializer,
    TransactionSerializer, DepositMpesaSerializer, WithdrawMpesaSerializer,
    WithdrawPaypalSerializer, DevDepositSerializer, ChatMessageSerializer,
    AdminUserSerializer, AdminAdjustBalanceSerializer, AdminTransactionSerializer,
    PlatformSettingsSerializer,
)
from . import mpesa as mpesa_client
from . import paypal as paypal_client

logger = logging.getLogger(__name__)


# ── Permissions ───────────────────────────────────────────────────────────────

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class IsNotBanned(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and not getattr(request.user, "is_banned", False)


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"detail": "Account created. You can now log in."},
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


# ── Wallet ────────────────────────────────────────────────────────────────────

class BalanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            {"balance": str(request.user.balance), "currency": "KES"}
        )


class DepositMpesaView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]

    def post(self, request):
        s = DepositMpesaSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        phone = s.validated_data["phone"]
        amount = s.validated_data["amount"]

        tx = Transaction.objects.create(
            user=request.user,
            type="deposit",
            method="mpesa",
            amount=amount,
            phone=phone,
            status="pending",
        )

        try:
            resp = mpesa_client.stk_push(
                phone=phone,
                amount=int(amount),
                account_ref=f"SHABIKI-{tx.id}",
                description="Shabiki Aviator Deposit",
            )
            tx.mpesa_checkout_id = resp.get("CheckoutRequestID", "")
            tx.reference = resp.get("MerchantRequestID", "")
            tx.save()
            return Response(
                {
                    "detail": "STK Push sent. Enter your M-Pesa PIN.",
                    "transaction_id": str(tx.id),
                    "checkout_request_id": tx.mpesa_checkout_id,
                }
            )
        except Exception as exc:
            tx.status = "failed"
            tx.note = str(exc)
            tx.save()
            logger.error("M-Pesa STK push failed: %s", exc)
            return Response(
                {"detail": "M-Pesa request failed. Try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class MpesaCallbackView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        data = request.data
        try:
            body = data["Body"]["stkCallback"]
            checkout_id = body["CheckoutRequestID"]
            result_code = body["ResultCode"]
            tx = Transaction.objects.get(mpesa_checkout_id=checkout_id)

            if result_code == 0:
                # Success — credit wallet
                with db_transaction.atomic():
                    tx.status = "completed"
                    tx.save()
                    tx.user.balance += tx.amount
                    tx.user.save()
            else:
                tx.status = "failed"
                tx.note = body.get("ResultDesc", "Payment failed")
                tx.save()
        except Exception as exc:
            logger.error("M-Pesa callback error: %s", exc)
        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


class DepositStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, tx_id):
        try:
            tx = Transaction.objects.get(id=tx_id, user=request.user)
            return Response(TransactionSerializer(tx).data)
        except Transaction.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)


class WithdrawMpesaView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]

    def post(self, request):
        s = WithdrawMpesaSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        phone = s.validated_data["phone"]
        amount = s.validated_data["amount"]
        user = request.user

        if user.balance < amount:
            return Response(
                {"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST
            )

        with db_transaction.atomic():
            user.balance -= amount
            user.save()
            tx = Transaction.objects.create(
                user=user,
                type="withdrawal",
                method="mpesa",
                amount=amount,
                phone=phone,
                status="pending",
            )

        if settings.DEV_MODE:
            tx.status = "completed"
            tx.note = "Dev mode instant approval"
            tx.save()
            return Response({"detail": "[DEV] Withdrawal approved instantly."})

        try:
            resp = mpesa_client.b2c_payment(phone=phone, amount=int(amount))
            tx.reference = resp.get("ConversationID", "")
            tx.save()
            return Response({"detail": "Withdrawal initiated. Funds on the way!"})
        except Exception as exc:
            # Rollback balance
            user.balance += amount
            user.save()
            tx.status = "failed"
            tx.note = str(exc)
            tx.save()
            return Response(
                {"detail": "Withdrawal failed."}, status=status.HTTP_502_BAD_GATEWAY
            )


class WithdrawPaypalView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]

    def post(self, request):
        s = WithdrawPaypalSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        email = s.validated_data["email"]
        amount = s.validated_data["amount"]
        user = request.user

        if user.balance < amount:
            return Response(
                {"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST
            )

        with db_transaction.atomic():
            user.balance -= amount
            user.save()
            tx = Transaction.objects.create(
                user=user,
                type="withdrawal",
                method="paypal",
                amount=amount,
                paypal_email=email,
                status="pending",
            )

        if settings.DEV_MODE:
            tx.status = "completed"
            tx.save()
            return Response({"detail": "[DEV] PayPal withdrawal approved instantly."})

        try:
            resp = paypal_client.send_payout(
                email=email,
                amount_kes=float(amount),
                sender_item_id=str(tx.id),
            )
            tx.paypal_payout_id = resp.get("batch_header", {}).get("payout_batch_id", "")
            tx.status = "completed"
            tx.save()
            return Response({"detail": "PayPal payout sent!"})
        except Exception as exc:
            user.balance += amount
            user.save()
            tx.status = "failed"
            tx.note = str(exc)
            tx.save()
            return Response(
                {"detail": "PayPal payout failed."}, status=status.HTTP_502_BAD_GATEWAY
            )


class DevDepositView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not settings.DEV_MODE:
            return Response(
                {"detail": "Dev mode is disabled."}, status=status.HTTP_403_FORBIDDEN
            )
        s = DevDepositSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        amount = s.validated_data["amount"]

        with db_transaction.atomic():
            request.user.balance += amount
            request.user.save()
            tx = Transaction.objects.create(
                user=request.user,
                type="deposit",
                method="dev",
                amount=amount,
                status="completed",
                note="Dev bypass deposit",
            )
        return Response(
            {
                "detail": f"[DEV] KES {amount} added to your wallet.",
                "new_balance": str(request.user.balance),
                "transaction_id": str(tx.id),
            }
        )


# ── Game ──────────────────────────────────────────────────────────────────────

class CurrentRoundView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            round_obj = GameRound.objects.exclude(status="crashed").latest("created_at")
            return Response(GameRoundSerializer(round_obj).data)
        except GameRound.DoesNotExist:
            return Response({"detail": "No active round."}, status=404)


class GameRoundListView(generics.ListAPIView):
    serializer_class = GameRoundListSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = GameRound.objects.filter(status="crashed").order_by("-created_at")[:50]


class PlaceBetView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotBanned]

    def post(self, request):
        s = PlaceBetSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        amount = s.validated_data["amount"]
        auto_cashout = s.validated_data.get("auto_cashout")
        user = request.user

        try:
            current_round = GameRound.objects.get(status="betting")
        except GameRound.DoesNotExist:
            return Response(
                {"detail": "Betting phase is not open."}, status=status.HTTP_400_BAD_REQUEST
            )

        if user.balance < amount:
            return Response(
                {"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST
            )

        if Bet.objects.filter(user=user, round=current_round).exists():
            return Response(
                {"detail": "You already have a bet in this round."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with db_transaction.atomic():
            user.balance -= amount
            user.total_wagered += amount
            user.save()
            bet = Bet.objects.create(
                user=user,
                round=current_round,
                amount=amount,
                auto_cashout=auto_cashout,
            )

        return Response(BetSerializer(bet).data, status=status.HTTP_201_CREATED)


class CashOutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        try:
            current_round = GameRound.objects.get(status="flying")
        except GameRound.DoesNotExist:
            return Response(
                {"detail": "No active flying round."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            bet = Bet.objects.get(user=user, round=current_round, status="placed")
        except Bet.DoesNotExist:
            return Response(
                {"detail": "No active bet found."}, status=status.HTTP_400_BAD_REQUEST
            )

        multiplier = current_round.current_multiplier
        payout = bet.amount * multiplier

        with db_transaction.atomic():
            bet.cashout_multiplier = multiplier
            bet.payout = payout
            bet.status = "won"
            bet.cashed_out_at = timezone.now()
            bet.save()

            user.balance += payout
            user.total_won += payout
            user.save()

        return Response(
            {
                "detail": "Cashed out!",
                "multiplier": str(multiplier),
                "payout": str(payout),
            }
        )


class MyBetsView(generics.ListAPIView):
    serializer_class = BetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Bet.objects.filter(user=self.request.user).order_by("-placed_at")[:50]


class LeaderboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        top = (
            User.objects.filter(total_wagered__gt=0)
            .order_by("-total_won")[:20]
            .values("username", "total_won", "total_wagered")
        )
        return Response(list(top))


# ── Transactions ──────────────────────────────────────────────────────────────

class TransactionListView(generics.ListAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).order_by("-created_at")[:100]


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        messages = ChatMessage.objects.order_by("-created_at")[:50]
        return Response(ChatMessageSerializer(reversed(list(messages)), many=True).data)


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        total_users = User.objects.count()
        active_users = User.objects.filter(
            bets__placed_at__date=timezone.now().date()
        ).distinct().count()
        total_deposited = (
            Transaction.objects.filter(type="deposit", status="completed")
            .aggregate(t=Sum("amount"))["t"]
            or 0
        )
        total_withdrawn = (
            Transaction.objects.filter(type="withdrawal", status="completed")
            .aggregate(t=Sum("amount"))["t"]
            or 0
        )
        total_wagered = User.objects.aggregate(t=Sum("total_wagered"))["t"] or 0
        total_won = User.objects.aggregate(t=Sum("total_won"))["t"] or 0
        house_profit = float(total_wagered) - float(total_won)

        rounds_today = GameRound.objects.filter(
            created_at__date=timezone.now().date()
        ).count()

        return Response(
            {
                "total_users": total_users,
                "active_users_today": active_users,
                "total_deposited": str(total_deposited),
                "total_withdrawn": str(total_withdrawn),
                "total_wagered": str(total_wagered),
                "total_won": str(total_won),
                "house_profit": str(house_profit),
                "rounds_today": rounds_today,
            }
        )


class AdminUserListView(generics.ListAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]
    queryset = User.objects.all().order_by("-date_joined")


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]
    queryset = User.objects.all()
    lookup_field = "id"


class AdminBanUserView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            user.is_banned = not user.is_banned
            user.save()
            action = "banned" if user.is_banned else "unbanned"
            return Response({"detail": f"User {user.username} has been {action}."})
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)


class AdminAdjustBalanceView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        s = AdminAdjustBalanceSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        amount = s.validated_data["amount"]
        note = s.validated_data["note"]

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)

        with db_transaction.atomic():
            user.balance += amount
            user.save()
            Transaction.objects.create(
                user=user,
                type="adjustment",
                method="internal",
                amount=amount,
                status="completed",
                note=f"Admin adjustment by {request.user.username}: {note}",
            )
        return Response(
            {"detail": f"Balance adjusted by KES {amount}. New balance: {user.balance}"}
        )


class AdminTransactionListView(generics.ListAPIView):
    serializer_class = AdminTransactionSerializer
    permission_classes = [IsAdminUser]
    queryset = Transaction.objects.all().order_by("-created_at")[:200]


class AdminTransactionUpdateView(generics.UpdateAPIView):
    serializer_class = AdminTransactionSerializer
    permission_classes = [IsAdminUser]
    queryset = Transaction.objects.all()
    lookup_field = "id"


class AdminGameListView(generics.ListAPIView):
    serializer_class = GameRoundListSerializer
    permission_classes = [IsAdminUser]
    queryset = GameRound.objects.all().order_by("-created_at")[:100]


class AdminGameControlView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        action = request.data.get("action")
        if action == "pause":
            s = PlatformSettings.get()
            s.game_paused = True
            s.save()
            return Response({"detail": "Game paused."})
        elif action == "resume":
            s = PlatformSettings.get()
            s.game_paused = False
            s.save()
            return Response({"detail": "Game resumed."})
        elif action == "force_crash":
            try:
                rnd = GameRound.objects.get(status__in=["betting", "flying"])
                rnd.status = "crashed"
                rnd.crashed_at = timezone.now()
                rnd.crash_point = rnd.current_multiplier
                rnd.save()
                # Mark all placed bets as lost
                rnd.bets.filter(status="placed").update(status="lost")
                return Response({"detail": "Round force-crashed."})
            except GameRound.DoesNotExist:
                return Response({"detail": "No active round to crash."}, status=400)
        return Response({"detail": "Unknown action."}, status=400)


class AdminSettingsView(generics.RetrieveUpdateAPIView):
    serializer_class = PlatformSettingsSerializer
    permission_classes = [IsAdminUser]

    def get_object(self):
        return PlatformSettings.get()
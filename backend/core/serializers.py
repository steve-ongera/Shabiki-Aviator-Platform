"""
core/serializers.py
"""
from decimal import Decimal
from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, GameRound, Bet, Transaction, ChatMessage, PlatformSettings


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "phone", "password", "password2"]

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError("Passwords do not match.")
        return data

    def create(self, validated_data):
        validated_data.pop("password2")
        return User.objects.create_user(**validated_data)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["is_staff"] = user.is_staff
        return token


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "username", "email", "phone", "balance",
            "is_staff", "is_banned", "total_wagered", "total_won",
            "profit_loss", "created_at",
        ]
        read_only_fields = ["id", "balance", "total_wagered", "total_won", "created_at"]


class UserPublicSerializer(serializers.ModelSerializer):
    """Minimal public info — used in leaderboard / live players list."""
    class Meta:
        model = User
        fields = ["id", "username"]


# ── Game ──────────────────────────────────────────────────────────────────────

class BetSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Bet
        fields = [
            "id", "username", "amount", "auto_cashout",
            "cashout_multiplier", "payout", "status",
            "placed_at", "cashed_out_at",
        ]
        read_only_fields = [
            "id", "cashout_multiplier", "payout", "status",
            "placed_at", "cashed_out_at",
        ]


class PlaceBetSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    auto_cashout = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=False, allow_null=True
    )

    def validate_amount(self, value):
        settings_obj = PlatformSettings.get()
        if value < settings_obj.min_bet:
            raise serializers.ValidationError(
                f"Minimum bet is KES {settings_obj.min_bet}."
            )
        if value > settings_obj.max_bet:
            raise serializers.ValidationError(
                f"Maximum bet is KES {settings_obj.max_bet}."
            )
        return value


class GameRoundSerializer(serializers.ModelSerializer):
    bets = BetSerializer(many=True, read_only=True)
    total_bets = serializers.ReadOnlyField()
    total_payout = serializers.ReadOnlyField()

    class Meta:
        model = GameRound
        fields = [
            "id", "status", "crash_point", "current_multiplier",
            "speed_factor", "started_at", "crashed_at", "created_at",
            "bets", "total_bets", "total_payout",
        ]


class GameRoundListSerializer(serializers.ModelSerializer):
    """Light serializer for history lists."""
    class Meta:
        model = GameRound
        fields = [
            "id", "status", "crash_point", "current_multiplier",
            "started_at", "crashed_at", "created_at",
        ]


# ── Wallet / Transactions ─────────────────────────────────────────────────────

class TransactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id", "username", "type", "method", "amount", "status",
            "reference", "phone", "paypal_email", "note",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "status", "reference", "created_at", "updated_at",
        ]


class DepositMpesaSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("10"))

    def validate_phone(self, value):
        # Normalise to 254XXXXXXXXX
        phone = value.strip().replace("+", "").replace(" ", "")
        if phone.startswith("0"):
            phone = "254" + phone[1:]
        if not phone.startswith("254") or len(phone) != 12:
            raise serializers.ValidationError(
                "Enter a valid Safaricom number, e.g. 0712345678."
            )
        return phone


class WithdrawMpesaSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("10"))


class WithdrawPaypalSerializer(serializers.Serializer):
    email = serializers.EmailField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("5"))


class DevDepositSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("1"))


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessageSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ChatMessage
        fields = ["id", "username", "message", "created_at"]
        read_only_fields = ["id", "username", "created_at"]


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "username", "email", "phone", "balance",
            "is_staff", "is_banned", "total_wagered", "total_won",
            "date_joined", "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login"]


class AdminAdjustBalanceSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    note = serializers.CharField(max_length=200, required=False, default="Admin adjustment")


class AdminTransactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Transaction
        fields = "__all__"


class PlatformSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSettings
        fields = [
            "min_bet", "max_bet", "house_edge",
            "max_multiplier_cap", "game_paused", "maintenance_mode",
        ]
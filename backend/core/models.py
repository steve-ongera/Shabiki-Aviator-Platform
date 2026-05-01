"""
core/models.py
All models for the Shabiki Aviator platform.
"""
import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


# ── User ──────────────────────────────────────────────────────────────────────

class User(AbstractUser):
    """Extended user with wallet balance and status flags."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=15, blank=True, default="")
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    is_banned = models.BooleanField(default=False)
    total_wagered = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_won = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.username

    @property
    def profit_loss(self):
        return self.total_won - self.total_wagered


# ── Game Round ─────────────────────────────────────────────────────────────────

class GameRound(models.Model):
    STATUS_CHOICES = [
        ("waiting", "Waiting"),
        ("betting", "Betting"),
        ("flying", "Flying"),
        ("crashed", "Crashed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="waiting")
    crash_point = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    server_seed = models.CharField(max_length=128, blank=True, default="")
    # How fast the multiplier grows this round (varies per round)
    speed_factor = models.FloatField(default=1.0)
    current_multiplier = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("1.00")
    )
    started_at = models.DateTimeField(null=True, blank=True)
    crashed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "game_rounds"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Round {self.id} — {self.status} @ {self.crash_point}x"

    @property
    def total_bets(self):
        return self.bets.aggregate(total=models.Sum("amount"))["total"] or Decimal("0")

    @property
    def total_payout(self):
        return (
            self.bets.filter(status="won").aggregate(
                total=models.Sum("payout")
            )["total"]
            or Decimal("0")
        )


# ── Bet ────────────────────────────────────────────────────────────────────────

class Bet(models.Model):
    STATUS_CHOICES = [
        ("placed", "Placed"),
        ("won", "Won"),
        ("lost", "Lost"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bets")
    round = models.ForeignKey(GameRound, on_delete=models.CASCADE, related_name="bets")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    auto_cashout = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    cashout_multiplier = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    payout = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="placed")
    placed_at = models.DateTimeField(auto_now_add=True)
    cashed_out_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "bets"
        unique_together = [("user", "round")]
        ordering = ["-placed_at"]

    def __str__(self):
        return f"{self.user.username} — {self.amount} KES @ {self.cashout_multiplier}x"


# ── Transaction ────────────────────────────────────────────────────────────────

class Transaction(models.Model):
    TYPE_CHOICES = [
        ("deposit", "Deposit"),
        ("withdrawal", "Withdrawal"),
        ("bet", "Bet"),
        ("win", "Win"),
        ("refund", "Refund"),
        ("adjustment", "Admin Adjustment"),
    ]
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]
    METHOD_CHOICES = [
        ("mpesa", "M-Pesa"),
        ("paypal", "PayPal"),
        ("dev", "Dev Bypass"),
        ("internal", "Internal"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transactions")
    type = models.CharField(max_length=12, choices=TYPE_CHOICES)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default="internal")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="pending")
    reference = models.CharField(max_length=128, blank=True, default="")
    mpesa_checkout_id = models.CharField(max_length=128, blank=True, default="")
    paypal_payout_id = models.CharField(max_length=128, blank=True, default="")
    phone = models.CharField(max_length=15, blank=True, default="")
    paypal_email = models.EmailField(blank=True, default="")
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transactions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} | {self.type} | {self.amount} KES | {self.status}"


# ── Chat Message ──────────────────────────────────────────────────────────────

class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_messages")
    message = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_messages"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username}: {self.message[:40]}"


# ── Platform Settings ─────────────────────────────────────────────────────────

class PlatformSettings(models.Model):
    """Singleton settings table — use PlatformSettings.get()."""
    min_bet = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("10"))
    max_bet = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("50000"))
    house_edge = models.FloatField(default=0.05)
    max_multiplier_cap = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("10000")
    )
    game_paused = models.BooleanField(default=False)
    maintenance_mode = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "platform_settings"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Platform Settings"
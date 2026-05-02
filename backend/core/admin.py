from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, GameRound, Bet, Transaction, ChatMessage, PlatformSettings


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "phone", "balance", "is_banned", "is_staff", "date_joined"]
    list_filter = ["is_banned", "is_staff", "is_superuser"]
    search_fields = ["username", "email", "phone"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Shabiki", {"fields": ("phone", "balance", "is_banned", "total_wagered", "total_won")}),
    )


@admin.register(GameRound)
class GameRoundAdmin(admin.ModelAdmin):
    list_display = ["id", "status", "crash_point", "current_multiplier", "speed_factor", "created_at"]
    list_filter = ["status"]
    readonly_fields = ["server_seed"]


@admin.register(Bet)
class BetAdmin(admin.ModelAdmin):
    list_display = ["user", "round", "amount", "status", "cashout_multiplier", "payout", "placed_at"]
    list_filter = ["status"]
    search_fields = ["user__username"]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["user", "type", "method", "amount", "status", "created_at"]
    list_filter = ["type", "method", "status"]
    search_fields = ["user__username", "reference", "mpesa_checkout_id"]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ["user", "message", "created_at"]
    search_fields = ["user__username", "message"]


@admin.register(PlatformSettings)
class PlatformSettingsAdmin(admin.ModelAdmin):
    list_display = ["min_bet", "max_bet", "house_edge", "game_paused", "maintenance_mode"]
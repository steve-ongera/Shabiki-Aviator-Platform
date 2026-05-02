"""
core/urls.py
All API URL patterns for the Shabiki platform.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────────────────
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),

    # ── Wallet ────────────────────────────────────────────────────────────────
    path("wallet/balance/", views.BalanceView.as_view(), name="balance"),
    path("wallet/deposit/mpesa/", views.DepositMpesaView.as_view(), name="deposit_mpesa"),
    path("wallet/deposit/dev/", views.DevDepositView.as_view(), name="deposit_dev"),
    path("wallet/deposit/status/<uuid:tx_id>/", views.DepositStatusView.as_view(), name="deposit_status"),
    path("wallet/mpesa/callback/", views.MpesaCallbackView.as_view(), name="mpesa_callback"),
    path("wallet/withdraw/mpesa/", views.WithdrawMpesaView.as_view(), name="withdraw_mpesa"),
    path("wallet/withdraw/paypal/", views.WithdrawPaypalView.as_view(), name="withdraw_paypal"),

    # ── Game ──────────────────────────────────────────────────────────────────
    path("game/current/", views.CurrentRoundView.as_view(), name="current_round"),
    path("game/rounds/", views.GameRoundListView.as_view(), name="round_list"),
    path("game/bet/", views.PlaceBetView.as_view(), name="place_bet"),
    path("game/cashout/", views.CashOutView.as_view(), name="cashout"),
    path("game/my-bets/", views.MyBetsView.as_view(), name="my_bets"),
    path("game/leaderboard/", views.LeaderboardView.as_view(), name="leaderboard"),

    # ── Transactions ──────────────────────────────────────────────────────────
    path("transactions/", views.TransactionListView.as_view(), name="transactions"),

    # ── Chat ──────────────────────────────────────────────────────────────────
    path("chat/history/", views.ChatHistoryView.as_view(), name="chat_history"),

    # ── Admin ─────────────────────────────────────────────────────────────────
    path("admin-panel/stats/", views.AdminStatsView.as_view(), name="admin_stats"),
    path("admin-panel/users/", views.AdminUserListView.as_view(), name="admin_users"),
    path("admin-panel/users/<uuid:id>/", views.AdminUserDetailView.as_view(), name="admin_user_detail"),
    path("admin-panel/users/<uuid:user_id>/ban/", views.AdminBanUserView.as_view(), name="admin_ban"),
    path("admin-panel/users/<uuid:user_id>/adjust/", views.AdminAdjustBalanceView.as_view(), name="admin_adjust"),
    path("admin-panel/transactions/", views.AdminTransactionListView.as_view(), name="admin_transactions"),
    path("admin-panel/transactions/<uuid:id>/", views.AdminTransactionUpdateView.as_view(), name="admin_tx_detail"),
    path("admin-panel/games/", views.AdminGameListView.as_view(), name="admin_games"),
    path("admin-panel/games/control/", views.AdminGameControlView.as_view(), name="admin_game_control"),
    path("admin-panel/settings/", views.AdminSettingsView.as_view(), name="admin_settings"),
]
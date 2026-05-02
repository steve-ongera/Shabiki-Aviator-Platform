"""
core/tasks.py
Celery tasks: game loop that drives round lifecycle via channel layer.
"""
import logging
import time
from decimal import Decimal
from celery import shared_task
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import GameRound, Bet, User, PlatformSettings
from .game_engine import generate_crash_point, generate_speed_factor, compute_multiplier

logger = logging.getLogger(__name__)
channel_layer = get_channel_layer()

GAME_GROUP = "game_room"
BETTING_DURATION = 5   # seconds
COOLDOWN_DURATION = 3  # seconds between rounds


def broadcast(event_type: str, **kwargs):
    """Fire-and-forget broadcast to the game group."""
    try:
        async_to_sync(channel_layer.group_send)(
            GAME_GROUP, {"type": event_type, **kwargs}
        )
    except Exception as exc:
        logger.warning("Broadcast failed: %s", exc)


@shared_task
def game_loop():
    """
    Celery beat task — called every second.
    Drives the full round state machine.
    """
    settings_obj = PlatformSettings.get()
    if settings_obj.game_paused or settings_obj.maintenance_mode:
        return

    # Find active round
    active = GameRound.objects.filter(status__in=["waiting", "betting", "flying"]).first()

    if active is None:
        _start_new_round()
        return

    if active.status == "waiting":
        # Immediately open betting
        active.status = "betting"
        active.save()
        broadcast(
            "game.betting",
            round_id=str(active.id),
            duration=BETTING_DURATION,
        )
        _broadcast_players(active)

    elif active.status == "betting":
        elapsed = (timezone.now() - active.created_at).total_seconds()
        if elapsed >= BETTING_DURATION:
            _begin_flight(active)

    elif active.status == "flying":
        _tick_flight(active)


def _start_new_round():
    from django.conf import settings as dj_settings
    house_edge = dj_settings.GAME_HOUSE_EDGE
    crash_point, seed = generate_crash_point(house_edge)
    speed = generate_speed_factor()
    rnd = GameRound.objects.create(
        status="betting",
        crash_point=Decimal(str(crash_point)),
        server_seed=seed,
        speed_factor=speed,
        current_multiplier=Decimal("1.00"),
    )
    broadcast(
        "game.betting",
        round_id=str(rnd.id),
        duration=BETTING_DURATION,
    )
    logger.info("New round started: %s  crash@%sx  speed=%.2f", rnd.id, crash_point, speed)


def _begin_flight(rnd: GameRound):
    rnd.status = "flying"
    rnd.started_at = timezone.now()
    rnd.current_multiplier = Decimal("1.00")
    rnd.save()
    broadcast(
        "game.state",
        status="flying",
        multiplier="1.00",
        round_id=str(rnd.id),
    )
    _broadcast_players(rnd)


def _tick_flight(rnd: GameRound):
    elapsed = (timezone.now() - rnd.started_at).total_seconds()
    current = compute_multiplier(elapsed, rnd.speed_factor)
    current_dec = Decimal(str(current))

    rnd.current_multiplier = current_dec
    rnd.save(update_fields=["current_multiplier"])

    # Check auto-cashouts
    pending_bets = Bet.objects.filter(round=rnd, status="placed").select_related("user")
    for bet in pending_bets:
        if bet.auto_cashout and current_dec >= bet.auto_cashout:
            _process_cashout(bet, current_dec)

    # Broadcast tick
    broadcast(
        "game.tick",
        multiplier=str(current_dec),
        round_id=str(rnd.id),
        elapsed=round(elapsed, 2),
    )

    # Check crash
    if current_dec >= rnd.crash_point:
        _crash_round(rnd, current_dec)


def _process_cashout(bet: Bet, multiplier: Decimal):
    from django.db import transaction as dbt
    payout = bet.amount * multiplier
    with dbt.atomic():
        bet.cashout_multiplier = multiplier
        bet.payout = payout
        bet.status = "won"
        bet.cashed_out_at = timezone.now()
        bet.save()

        user = bet.user
        user.balance += payout
        user.total_won += payout
        user.save()

    # Live feed broadcast
    broadcast(
        "live.play",
        event="cashout",
        username=bet.user.username,
        amount=str(bet.amount),
        multiplier=str(multiplier),
        payout=str(payout),
    )
    # Notify individual user
    try:
        async_to_sync(channel_layer.group_send)(
            GAME_GROUP,
            {
                "type": "bet.result",
                "user_id": str(bet.user.id),
                "won": True,
                "multiplier": str(multiplier),
                "payout": str(payout),
            },
        )
    except Exception:
        pass

    # Update players list
    _broadcast_players(bet.round)


def _crash_round(rnd: GameRound, final_multiplier: Decimal):
    from django.db import transaction as dbt
    with dbt.atomic():
        rnd.status = "crashed"
        rnd.crashed_at = timezone.now()
        # Use the actual crash point (may differ slightly from computed)
        rnd.save()

        # Mark all un-cashed bets as lost
        lost_bets = Bet.objects.filter(round=rnd, status="placed").select_related("user")
        for bet in lost_bets:
            bet.status = "lost"
            bet.save()
            try:
                async_to_sync(channel_layer.group_send)(
                    GAME_GROUP,
                    {
                        "type": "bet.result",
                        "user_id": str(bet.user.id),
                        "won": False,
                        "multiplier": str(rnd.crash_point),
                        "payout": "0",
                    },
                )
            except Exception:
                pass

    broadcast(
        "game.crash",
        crash_point=str(rnd.crash_point),
        round_id=str(rnd.id),
    )
    logger.info("Round %s crashed at %sx", rnd.id, rnd.crash_point)

    # Small cooldown then start next round
    time.sleep(COOLDOWN_DURATION)
    _start_new_round()


def _broadcast_players(rnd: GameRound):
    bets = list(
        Bet.objects.filter(round=rnd)
        .select_related("user")
        .values("user__username", "amount", "status", "cashout_multiplier", "auto_cashout")
    )
    players = [
        {
            "username": b["user__username"],
            "bet": str(b["amount"]),
            "status": b["status"],
            "cashout": str(b["cashout_multiplier"]) if b["cashout_multiplier"] else None,
            "auto_cashout": str(b["auto_cashout"]) if b["auto_cashout"] else None,
        }
        for b in bets
    ]
    broadcast("players.update", players=players, round_id=str(rnd.id))
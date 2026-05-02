"""
core/management/commands/rungame.py
Dev-friendly game runner — no Redis or Celery required.
Run with:  python manage.py rungame
"""
import time
import signal
import sys
import logging
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import GameRound, Bet, PlatformSettings
from core.game_engine import generate_crash_point, generate_speed_factor, compute_multiplier

logger = logging.getLogger(__name__)

BETTING_DURATION = 5
COOLDOWN_DURATION = 3
TICK_RATE = 0.1  # seconds per tick

running = True


def _sigint(sig, frame):
    global running
    print("\n🛑  Stopping game loop...")
    running = False


signal.signal(signal.SIGINT, _sigint)


class Command(BaseCommand):
    help = "Run the Aviator game loop in-process (dev mode — no Celery/Redis needed)"

    def handle(self, *args, **options):
        from django.conf import settings as dj_settings
        self.stdout.write(self.style.SUCCESS("✈️  Shabiki game loop starting..."))
        self.stdout.write("Press Ctrl+C to stop.\n")

        while running:
            settings_obj = PlatformSettings.get()
            if settings_obj.game_paused or settings_obj.maintenance_mode:
                self.stdout.write("⏸  Game paused. Waiting...")
                time.sleep(2)
                continue

            # --- Betting phase ---
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
            self.stdout.write(
                self.style.WARNING(
                    f"\n🎲  Round {str(rnd.id)[:8]}  |  crash@{crash_point}x  |  speed={speed:.2f}"
                )
            )
            self.stdout.write(f"⏳  Betting phase ({BETTING_DURATION}s)...")
            _countdown(BETTING_DURATION)
            if not running:
                break

            # --- Flight phase ---
            rnd.status = "flying"
            rnd.started_at = timezone.now()
            rnd.save()
            self.stdout.write("🛫  Takeoff!")

            while running:
                rnd.refresh_from_db()
                if rnd.status == "crashed":
                    # Force-crashed by admin
                    self.stdout.write(self.style.ERROR("🛑  Round force-crashed by admin."))
                    break

                elapsed = (timezone.now() - rnd.started_at).total_seconds()
                current = compute_multiplier(elapsed, rnd.speed_factor)
                current_dec = Decimal(str(current))
                rnd.current_multiplier = current_dec
                rnd.save(update_fields=["current_multiplier"])

                # Auto cashouts
                for bet in Bet.objects.filter(round=rnd, status="placed").select_related("user"):
                    if bet.auto_cashout and current_dec >= bet.auto_cashout:
                        _do_cashout(bet, current_dec)
                        self.stdout.write(
                            f"  💰 AUTO cashout: {bet.user.username} @ {current_dec}x"
                        )

                sys.stdout.write(f"\r  📈  {current_dec:.2f}x    ")
                sys.stdout.flush()

                if current_dec >= rnd.crash_point:
                    break
                time.sleep(TICK_RATE)

            # --- Crash ---
            if running:
                _crash(rnd)
                self.stdout.write(
                    self.style.ERROR(f"\n💥  CRASHED at {rnd.crash_point}x!")
                )

            self.stdout.write(f"⏳  Cooldown ({COOLDOWN_DURATION}s)...")
            _countdown(COOLDOWN_DURATION)

        self.stdout.write(self.style.SUCCESS("\nGame loop stopped."))


def _countdown(seconds: int):
    for i in range(seconds, 0, -1):
        if not running:
            break
        sys.stdout.write(f"\r  {i}s remaining...   ")
        sys.stdout.flush()
        time.sleep(1)
    print()


def _do_cashout(bet: Bet, multiplier: Decimal):
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


def _crash(rnd: GameRound):
    from django.db import transaction as dbt
    with dbt.atomic():
        rnd.status = "crashed"
        rnd.crashed_at = timezone.now()
        rnd.save()
        for bet in Bet.objects.filter(round=rnd, status="placed"):
            bet.status = "lost"
            bet.save()
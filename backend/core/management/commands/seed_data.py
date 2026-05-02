"""
core/management/commands/seed_data.py

Populates the database with realistic test data for development.

Usage:
    python manage.py seed_data                  # default (50 users, 100 rounds)
    python manage.py seed_data --users 20 --rounds 50
    python manage.py seed_data --flush          # wipe existing data first
    python manage.py seed_data --quiet          # suppress progress output
"""

import hmac
import hashlib
import os
import random
from decimal import Decimal
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import Bet, ChatMessage, GameRound, PlatformSettings, Transaction

User = get_user_model()

# ── Realistic Kenyan data pools ───────────────────────────────────────────────

KENYAN_FIRST_NAMES = [
    "Wanjiku", "Kamau", "Otieno", "Akinyi", "Muthoni", "Kipchoge",
    "Zawadi", "Baraka", "Amani", "Jomo", "Waweru", "Adhiambo",
    "Njoroge", "Chebet", "Ochieng", "Wairimu", "Mutua", "Auma",
    "Kariuki", "Njoki", "Omondi", "Wangari", "Kilonzo", "Nekesa",
    "Githinji", "Awuor", "Ndegwa", "Chepkoech", "Lumumba", "Moraa",
]

KENYAN_LAST_NAMES = [
    "Mwangi", "Otieno", "Kamau", "Odhiambo", "Njoroge", "Achieng",
    "Kimani", "Owino", "Waweru", "Adhiambo", "Karanja", "Ouma",
    "Gitonga", "Onyango", "Mugo", "Awuor", "Njenga", "Okello",
    "Gicheru", "Anyango", "Ndegwa", "Simiyu", "Muriuki", "Cheruiyot",
    "Thuku", "Ogola", "Macharia", "Wekesa", "Kinyanjui", "Ogunde",
]

CHAT_MESSAGES = [
    "Niliweza kupata 5x leo asubuhi! 🚀",
    "Hii mchezo ni ya kuamua haraka sana",
    "Nakupeleka mbinguni leo! ✈️",
    "Cashout at 2x always safe strategy",
    "Niliamini 10x itatokea... crashed at 1.2 😭",
    "Pesa imekwenda haraka sana bro",
    "Shabiki inabetter kuliko zote!",
    "Let's go 50x!! 🌙",
    "Pole pole ndio mwendo, cashout early",
    "Niko na bahati leo, naendelea!",
    "This round will moon trust me 🚀🚀",
    "Lost 500 bob in 10 seconds lol",
    "Auto cashout at 1.5x is my secret",
    "Wacha mchezo huu unanikuua financially",
    "GG everyone, see you next round",
    "Dropped from 3k to 500 bob in 20 min",
    "Who else waiting for that 100x? 😂",
    "Naomba mungu anikubaliane na mchezo huu",
    "Risk it for the biscuit! YOLO",
    "Patience is key. Wait for the right moment.",
    "Just won 2,400 KES from 200 bet! 🎉",
    "Kila mtu apanga mkakati wake",
    "Do not chase losses, discipline!",
    "Admin support please, deposit pending",
    "Hii server iko sawa leo",
    "Playing since 6am, finally winning",
    "Saa hii niko juu kabisa!",
    "Cashout at 1.8 = profit every time (sometimes)",
    "Who cashed out at 50x just now?? 👀",
    "Mpesa ya kwangu haijaingia bado",
]

SAFE_PASSWORDS = [
    "Test@1234", "Shabiki!99", "Gaming2024!", "Kenya@Wins1",
    "Aviator#77", "Mbaya@Noo1", "Jomo@2024!", "Waweru!Pass9",
]


# ── Crash point generator (mirrors production algorithm) ─────────────────────

def generate_crash_point(house_edge: float = 0.05) -> tuple[float, str]:
    seed = os.urandom(32).hex()
    h    = hmac.new(seed.encode(), digestmod=hashlib.sha256).hexdigest()
    n    = int(h[:8], 16)
    result = max(1.01, (100 / (1 - (n / 0xFFFFFFFF))) * (1 - house_edge))
    # Weight distribution toward realistic values
    # ~50% land < 2×, ~25% 2-5×, ~15% 5-20×, ~8% 20-100×, ~2% 100×+
    roll = random.random()
    if roll < 0.50:
        result = round(random.uniform(1.01, 1.99), 2)
    elif roll < 0.75:
        result = round(random.uniform(2.00, 4.99), 2)
    elif roll < 0.90:
        result = round(random.uniform(5.00, 19.99), 2)
    elif roll < 0.98:
        result = round(random.uniform(20.00, 99.99), 2)
    else:
        result = round(random.uniform(100.00, 1000.00), 2)
    return result, seed


# ── Helper: weighted random bet amount (Kenyan player distribution) ───────────

def random_bet_amount() -> Decimal:
    """Most Kenyans bet small; occasional whales."""
    bucket = random.random()
    if bucket < 0.40:
        return Decimal(str(random.choice([10, 20, 50, 50, 100])))
    elif bucket < 0.70:
        return Decimal(str(random.choice([100, 200, 200, 500])))
    elif bucket < 0.88:
        return Decimal(str(random.choice([500, 1000, 1000, 2000])))
    elif bucket < 0.97:
        return Decimal(str(random.choice([2000, 5000, 10000])))
    else:
        return Decimal(str(random.choice([10000, 20000, 50000])))


# ── Command ───────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Seed the database with realistic Shabiki Aviator development data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--users",
            type=int,
            default=50,
            help="Number of regular users to create (default: 50)",
        )
        parser.add_argument(
            "--rounds",
            type=int,
            default=100,
            help="Number of completed game rounds to create (default: 100)",
        )
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all existing seeded data before seeding",
        )
        parser.add_argument(
            "--quiet",
            action="store_true",
            help="Suppress progress messages",
        )

    # ── Entry point ───────────────────────────────────────────

    def handle(self, *args, **options):
        self.quiet = options["quiet"]

        if options["flush"]:
            self._flush()

        with transaction.atomic():
            self._seed_platform_settings()
            admin      = self._seed_superuser()
            staff      = self._seed_staff()
            users      = self._seed_users(options["users"])
            all_players = [admin] + staff + users

            rounds = self._seed_rounds(options["rounds"], all_players)
            self._seed_chat_messages(users)

        self._print_summary(users, rounds)

    # ── Flush ─────────────────────────────────────────────────

    def _flush(self):
        self._log("🗑  Flushing existing data…")
        ChatMessage.objects.all().delete()
        Bet.objects.all().delete()
        Transaction.objects.all().delete()
        GameRound.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        self._log("   Done.\n")

    # ── Platform settings ─────────────────────────────────────

    def _seed_platform_settings(self):
        settings = PlatformSettings.get()
        settings.min_bet             = Decimal("10")
        settings.max_bet             = Decimal("50000")
        settings.house_edge          = 0.05
        settings.max_multiplier_cap  = Decimal("10000")
        settings.game_paused         = False
        settings.maintenance_mode    = False
        settings.save()
        self._log("⚙️  Platform settings configured.")

    # ── Superuser ─────────────────────────────────────────────

    def _seed_superuser(self) -> User:
        user, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email":       "admin@shabiki.co.ke",
                "phone":       "0700000001",
                "is_staff":    True,
                "is_superuser": True,
                "balance":     Decimal("0.00"),
            },
        )
        if created:
            user.set_password("admin1234!")
            user.save()
            self._log("👑  Superuser created  — admin / admin1234!")
        else:
            self._log("👑  Superuser already exists — skipping.")
        return user

    # ── Staff accounts ────────────────────────────────────────

    def _seed_staff(self) -> list[User]:
        staff_data = [
            {"username": "moderator",  "email": "mod@shabiki.co.ke",   "phone": "0700000002"},
            {"username": "support",    "email": "support@shabiki.co.ke","phone": "0700000003"},
        ]
        created_staff = []
        for data in staff_data:
            user, created = User.objects.get_or_create(
                username=data["username"],
                defaults={
                    **data,
                    "is_staff":  True,
                    "balance":   Decimal("0.00"),
                },
            )
            if created:
                user.set_password("Staff@1234!")
                user.save()
            created_staff.append(user)
        self._log(f"🛡  {len(created_staff)} staff accounts ready.")
        return created_staff

    # ── Regular users ─────────────────────────────────────────

    def _seed_users(self, count: int) -> list[User]:
        self._log(f"👤  Creating {count} player accounts…")
        users = []
        existing = set(
            User.objects.filter(is_staff=False, is_superuser=False)
            .values_list("username", flat=True)
        )

        phone_counter = 710_000_010

        for i in range(count):
            first = random.choice(KENYAN_FIRST_NAMES)
            last  = random.choice(KENYAN_LAST_NAMES)
            username = f"{first.lower()}{last.lower()}{random.randint(1,999)}"

            # Guarantee uniqueness within this seed run
            if username in existing:
                username = f"{username}_{i}"
            existing.add(username)

            balance = Decimal(str(round(random.uniform(0, 15_000), 2)))

            # Occasional banned player
            is_banned = random.random() < 0.04

            user = User(
                username      = username,
                email         = f"{username}@example.co.ke",
                phone         = f"07{phone_counter + i:08d}"[:12],
                first_name    = first,
                last_name     = last,
                balance       = balance,
                is_banned     = is_banned,
                date_joined   = timezone.now() - timedelta(days=random.randint(1, 365)),
            )
            user.set_password(random.choice(SAFE_PASSWORDS))
            users.append(user)

        User.objects.bulk_create(users, ignore_conflicts=True)
        # Re-fetch to get PKs
        users = list(
            User.objects.filter(is_staff=False, is_superuser=False).order_by("-date_joined")[: count]
        )
        self._log(f"   ✓ {len(users)} players ready.")
        return users

    # ── Game rounds ───────────────────────────────────────────

    def _seed_rounds(self, count: int, players: list[User]) -> list[GameRound]:
        self._log(f"🎮  Seeding {count} game rounds with bets…")
        rounds      = []
        bets        = []
        txns        = []
        user_deltas: dict[str, Decimal] = {}  # username → net balance change

        now = timezone.now()

        for i in range(count):
            crash_point, seed = generate_crash_point(house_edge=0.05)

            # Rounds spread over the last 7 days (~1 per 6 min)
            minutes_ago = (count - i) * 6 + random.randint(-2, 2)
            started_at  = now - timedelta(minutes=minutes_ago)
            crashed_at  = started_at + timedelta(seconds=random.uniform(2, 30))

            rnd = GameRound(
                status              = "crashed",
                crash_point         = Decimal(str(crash_point)),
                server_seed         = seed,
                speed_factor        = round(random.uniform(0.6, 2.5), 2),
                current_multiplier  = Decimal(str(crash_point)),
                started_at          = started_at,
                crashed_at          = crashed_at,
                created_at          = started_at,
            )
            rounds.append(rnd)

        GameRound.objects.bulk_create(rounds)
        # Re-fetch with PKs
        rounds = list(GameRound.objects.filter(status="crashed").order_by("created_at")[: count])

        for rnd in rounds:
            crash_point = float(rnd.crash_point)

            # 3–18 bettors per round
            round_players = random.sample(players, min(random.randint(3, 18), len(players)))

            for player in round_players:
                amount = random_bet_amount()

                # Auto-cashout target (40% of players set one)
                auto_cashout = None
                if random.random() < 0.40:
                    auto_cashout = Decimal(str(round(random.uniform(1.2, 10.0), 2)))

                # Determine cashout
                cashed_out    = False
                cashout_multi = None

                if auto_cashout and float(auto_cashout) <= crash_point:
                    # Auto-cashout triggers before crash
                    cashout_multi = auto_cashout
                    cashed_out    = True
                elif not auto_cashout and random.random() < 0.35:
                    # Manual cashout at a random point before crash
                    cashout_multi = Decimal(str(round(random.uniform(1.01, crash_point), 2)))
                    cashed_out    = True

                if cashed_out and cashout_multi:
                    payout = (amount * cashout_multi).quantize(Decimal("0.01"))
                    status = "won"
                else:
                    payout        = Decimal("0.00")
                    cashout_multi = None
                    status        = "lost"

                bet = Bet(
                    user               = player,
                    round              = rnd,
                    amount             = amount,
                    auto_cashout       = auto_cashout,
                    cashout_multiplier = cashout_multi,
                    payout             = payout,
                    status             = status,
                    placed_at          = rnd.started_at,
                    cashed_out_at      = rnd.crashed_at if cashed_out else None,
                )
                bets.append(bet)

                # Track balance delta per user
                uid = str(player.pk)
                if uid not in user_deltas:
                    user_deltas[uid] = Decimal("0.00")
                user_deltas[uid] -= amount          # deducted when bet placed
                if cashed_out:
                    user_deltas[uid] += payout      # added when won

                # Internal transactions for audit trail
                txns.append(Transaction(
                    user    = player,
                    type    = "bet",
                    method  = "internal",
                    amount  = amount,
                    status  = "completed",
                    reference = str(rnd.pk)[:20],
                    created_at = rnd.started_at,
                ))
                if cashed_out:
                    txns.append(Transaction(
                        user    = player,
                        type    = "win",
                        method  = "internal",
                        amount  = payout,
                        status  = "completed",
                        reference = str(rnd.pk)[:20],
                        created_at = rnd.crashed_at,
                    ))

        Bet.objects.bulk_create(bets, ignore_conflicts=True)

        # Bulk-create transactions in chunks to avoid huge INSERT
        chunk_size = 500
        for start in range(0, len(txns), chunk_size):
            Transaction.objects.bulk_create(txns[start:start + chunk_size])

        # Update user stats
        self._update_user_stats(players)

        # Seed deposit / withdrawal transactions for realism
        self._seed_payment_transactions(players)

        self._log(f"   ✓ {len(rounds)} rounds, {len(bets)} bets, {len(txns)} game transactions.")
        return rounds

    # ── Update user stats from actual bets ────────────────────

    def _update_user_stats(self, players: list[User]):
        for player in players:
            from django.db.models import Sum as DSum
            agg = player.bets.aggregate(
                wagered=DSum("amount"),
                won=DSum("payout"),
            )
            player.total_wagered = agg["wagered"] or Decimal("0")
            player.total_won     = agg["won"]     or Decimal("0")

        User.objects.bulk_update(players, ["total_wagered", "total_won"])

    # ── Deposit / withdrawal history ──────────────────────────

    def _seed_payment_transactions(self, players: list[User]):
        txns = []
        now  = timezone.now()

        for player in players:
            # 1–5 deposits per player
            for _ in range(random.randint(1, 5)):
                amount    = Decimal(str(random.choice([100, 200, 500, 1000, 2000, 5000])))
                method    = random.choice(["mpesa", "mpesa", "mpesa", "paypal", "dev"])
                days_ago  = random.randint(1, 30)
                status    = random.choices(
                    ["completed", "completed", "completed", "failed", "pending"],
                    weights=[70, 70, 70, 10, 5],
                )[0]
                txns.append(Transaction(
                    user       = player,
                    type       = "deposit",
                    method     = method,
                    amount     = amount,
                    status     = status,
                    phone      = player.phone if method == "mpesa" else "",
                    reference  = f"REF{random.randint(100000, 999999)}",
                    created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23)),
                ))

            # 0–2 withdrawals per player
            for _ in range(random.randint(0, 2)):
                amount   = Decimal(str(random.choice([500, 1000, 2000, 5000])))
                method   = random.choice(["mpesa", "paypal"])
                days_ago = random.randint(0, 14)
                status   = random.choices(
                    ["completed", "completed", "pending", "failed"],
                    weights=[60, 60, 20, 10],
                )[0]
                txns.append(Transaction(
                    user         = player,
                    type         = "withdrawal",
                    method       = method,
                    amount       = amount,
                    status       = status,
                    phone        = player.phone if method == "mpesa" else "",
                    paypal_email = f"{player.username}@paypal.com" if method == "paypal" else "",
                    reference    = f"WD{random.randint(100000, 999999)}",
                    created_at   = now - timedelta(days=days_ago, hours=random.randint(0, 23)),
                ))

        chunk_size = 500
        for start in range(0, len(txns), chunk_size):
            Transaction.objects.bulk_create(txns[start:start + chunk_size])

        self._log(f"   ✓ {len(txns)} deposit/withdrawal records seeded.")

    # ── Chat messages ─────────────────────────────────────────

    def _seed_chat_messages(self, users: list[User]):
        if not users:
            return
        now  = timezone.now()
        msgs = []
        for i in range(min(120, len(users) * 3)):
            user    = random.choice(users)
            content = random.choice(CHAT_MESSAGES)
            msgs.append(ChatMessage(
                user       = user,
                message    = content,
                created_at = now - timedelta(minutes=random.randint(1, 180)),
            ))
        ChatMessage.objects.bulk_create(msgs)
        self._log(f"💬  {len(msgs)} chat messages seeded.")

    # ── Summary ───────────────────────────────────────────────

    def _print_summary(self, users: list[User], rounds: list[GameRound]):
        total_bets = Bet.objects.count()
        total_txns = Transaction.objects.count()
        won_bets   = Bet.objects.filter(status="won").count()
        pct_won    = round(won_bets / total_bets * 100, 1) if total_bets else 0

        self.stdout.write("\n" + "─" * 52)
        self.stdout.write(self.style.SUCCESS("  ✅  Seed complete!"))
        self.stdout.write("─" * 52)
        self.stdout.write(f"  Players          : {len(users)}")
        self.stdout.write(f"  Game rounds      : {len(rounds)}")
        self.stdout.write(f"  Bets             : {total_bets}  ({pct_won}% winning)")
        self.stdout.write(f"  Transactions     : {total_txns}")
        self.stdout.write(f"  Chat messages    : {ChatMessage.objects.count()}")
        self.stdout.write("─" * 52)
        self.stdout.write("  Login credentials:")
        self.stdout.write("    admin      / admin1234!   (superuser)")
        self.stdout.write("    moderator  / Staff@1234!  (staff)")
        self.stdout.write("    support    / Staff@1234!  (staff)")
        self.stdout.write(f"    {users[0].username:<10} / (any SAFE_PASSWORDS)  (player)")
        self.stdout.write("─" * 52 + "\n")

    # ── Internal logger ───────────────────────────────────────

    def _log(self, msg: str):
        if not self.quiet:
            self.stdout.write(msg)
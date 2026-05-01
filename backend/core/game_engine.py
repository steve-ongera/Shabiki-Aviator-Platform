"""
core/game_engine.py
Provably-fair crash point generation and game-state helpers.
"""
import hmac
import hashlib
import os
import random
import math
from decimal import Decimal


def generate_crash_point(house_edge: float = 0.05) -> tuple[float, str]:
    """
    Provably fair crash-point algorithm.
    Returns (crash_point, server_seed).
    Crash point is at least 1.00.
    """
    seed = os.urandom(32).hex()
    h = hmac.new(seed.encode(), digestmod=hashlib.sha256).hexdigest()
    n = int(h[:8], 16)
    # Avoid division-by-zero when n == 0xFFFFFFFF
    denominator = 1 - (n / (0xFFFFFFFF + 1))
    if denominator <= 0:
        denominator = 1e-9
    result = max(1.00, (100 / denominator) * (1 - house_edge))
    return round(result, 2), seed


def generate_speed_factor() -> float:
    """
    Random speed factor per round so the plane moves at different rates.
    Range 0.6 – 2.5 — this controls how fast the multiplier climbs.
    """
    return round(random.uniform(0.6, 2.5), 3)


def compute_multiplier(elapsed_seconds: float, speed_factor: float = 1.0) -> float:
    """
    Exponential multiplier growth:  M(t) = e^(k * t)
    where k = 0.06 * speed_factor.
    At speed_factor=1, M reaches ~2x after ~11.5s, ~10x after ~38s.
    The varying speed_factor makes each round feel different.
    """
    k = 0.06 * speed_factor
    value = math.exp(k * elapsed_seconds)
    return round(value, 2)


def verify_crash_point(server_seed: str, crash_point: float, house_edge: float = 0.05) -> bool:
    """Verify a historical round's crash point against its seed."""
    h = hmac.new(server_seed.encode(), digestmod=hashlib.sha256).hexdigest()
    n = int(h[:8], 16)
    denominator = 1 - (n / (0xFFFFFFFF + 1))
    if denominator <= 0:
        denominator = 1e-9
    expected = round(max(1.00, (100 / denominator) * (1 - house_edge)), 2)
    return abs(expected - crash_point) < 0.01
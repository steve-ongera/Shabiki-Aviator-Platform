"""
core/paypal.py
PayPal Payouts API helper for withdrawals.
"""
import requests
from django.conf import settings


def _get_access_token() -> str:
    base_url = (
        "https://api-m.sandbox.paypal.com"
        if settings.PAYPAL_ENVIRONMENT == "sandbox"
        else "https://api-m.paypal.com"
    )
    resp = requests.post(
        f"{base_url}/v1/oauth2/token",
        data={"grant_type": "client_credentials"},
        auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def send_payout(email: str, amount_kes: float, sender_item_id: str) -> dict:
    """
    Send PayPal payout to the given email.
    NOTE: PayPal Payouts API works in USD; conversion is illustrative.
    In production, use a proper FX rate or accept USD directly.
    """
    base_url = (
        "https://api-m.sandbox.paypal.com"
        if settings.PAYPAL_ENVIRONMENT == "sandbox"
        else "https://api-m.paypal.com"
    )
    token = _get_access_token()
    # Very rough conversion — replace with a live FX call in production.
    usd_amount = round(amount_kes / 130, 2)

    payload = {
        "sender_batch_header": {
            "sender_batch_id": sender_item_id,
            "email_subject": "backend Aviator — Your withdrawal",
        },
        "items": [
            {
                "recipient_type": "EMAIL",
                "amount": {"value": str(usd_amount), "currency": "USD"},
                "receiver": email,
                "sender_item_id": sender_item_id,
                "note": "backend withdrawal",
            }
        ],
    }
    resp = requests.post(
        f"{base_url}/v1/payments/payouts",
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()
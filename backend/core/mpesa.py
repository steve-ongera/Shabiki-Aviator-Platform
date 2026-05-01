"""
core/mpesa.py
Safaricom Daraja API helpers (STK Push + B2C withdrawal).
"""
import base64
import requests
from datetime import datetime
from django.conf import settings


def _get_access_token() -> str:
    env = settings.MPESA_ENVIRONMENT
    base_url = (
        "https://sandbox.safaricom.co.ke"
        if env == "sandbox"
        else "https://api.safaricom.co.ke"
    )
    resp = requests.get(
        f"{base_url}/oauth/v1/generate?grant_type=client_credentials",
        auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def _base_url():
    if settings.MPESA_ENVIRONMENT == "sandbox":
        return "https://sandbox.safaricom.co.ke"
    return "https://api.safaricom.co.ke"


def stk_push(phone: str, amount: int, account_ref: str, description: str) -> dict:
    """Initiate Lipa Na M-Pesa STK Push. Returns Daraja API response dict."""
    token = _get_access_token()
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    shortcode = settings.MPESA_SHORTCODE
    passkey = settings.MPESA_PASSKEY
    password = base64.b64encode(
        f"{shortcode}{passkey}{timestamp}".encode()
    ).decode()

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": settings.MPESA_CALLBACK_URL,
        "AccountReference": account_ref,
        "TransactionDesc": description,
    }

    resp = requests.post(
        f"{_base_url()}/mpesa/stkpush/v1/processrequest",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def b2c_payment(phone: str, amount: int, remarks: str = "Withdrawal") -> dict:
    """Initiate B2C (withdrawal) payment."""
    token = _get_access_token()
    payload = {
        "InitiatorName": "testapi",
        "SecurityCredential": "your_encrypted_credential",  # replace in production
        "CommandID": "BusinessPayment",
        "Amount": int(amount),
        "PartyA": settings.MPESA_SHORTCODE,
        "PartyB": phone,
        "Remarks": remarks,
        "QueueTimeOutURL": settings.MPESA_CALLBACK_URL + "timeout/",
        "ResultURL": settings.MPESA_CALLBACK_URL + "b2c/",
        "Occasion": "",
    }
    resp = requests.post(
        f"{_base_url()}/mpesa/b2c/v1/paymentrequest",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()
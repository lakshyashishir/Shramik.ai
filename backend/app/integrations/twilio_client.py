from urllib.parse import urlparse

import httpx

from app.config import settings
from app.integrations.phone import normalize_phone_number


class TwilioConfigError(RuntimeError):
    pass


def is_twilio_configured() -> bool:
    return bool(
        settings.twilio_enabled
        and settings.twilio_account_sid
        and settings.twilio_auth_token
        and settings.twilio_phone_number
    )


def build_twiml_url(session_id: str) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/calls/twilio/twiml?session_id={session_id}"


def build_status_callback_url(session_id: str) -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/calls/twilio/status?session_id={session_id}"


def extract_twilio_sid(payload: dict[str, object]) -> str | None:
    sid = payload.get("CallSid") or payload.get("call_sid")
    return str(sid) if sid else None


async def start_outbound_call(
    *,
    to_number: str,
    session_id: str,
    timeout: int = 30,
) -> dict:
    if not is_twilio_configured():
        raise TwilioConfigError("Twilio is not fully configured")

    account_sid = settings.twilio_account_sid
    endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json"
    payload = {
        "To": normalize_phone_number(to_number),
        "From": normalize_phone_number(settings.twilio_phone_number),
        "Url": build_twiml_url(session_id),
        "Method": "POST",
        "StatusCallback": build_status_callback_url(session_id),
        "StatusCallbackMethod": "POST",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            endpoint,
            data=payload,
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
        )

    response.raise_for_status()
    data = response.json()
    return {
        "sid": data.get("sid"),
        "status": data.get("status"),
        "raw": data,
    }


def safe_host(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc or url


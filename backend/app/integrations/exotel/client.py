from urllib.parse import urlparse

import httpx

from app.config import settings


class ExotelConfigError(RuntimeError):
    pass


def is_exotel_configured() -> bool:
    return bool(
        settings.exotel_enabled
        and settings.exotel_account_sid
        and settings.exotel_api_key
        and settings.exotel_api_token
        and settings.exotel_caller_id
        and (settings.exotel_app_flow_url or settings.exotel_app_id)
    )


def _build_flow_url() -> str:
    if settings.exotel_app_flow_url:
        return settings.exotel_app_flow_url
    if settings.exotel_app_id:
        return f"http://my.exotel.in/exoml/start/{settings.exotel_app_id}"
    raise ExotelConfigError("Exotel app flow is not configured")


def build_status_callback_url() -> str:
    return f"{settings.public_base_url.rstrip('/')}/api/calls/exotel/status"


def normalize_indian_phone_number(value: str | None) -> str | None:
    if not value:
        return value
    digits = "".join(ch for ch in value if ch.isdigit())
    if not digits:
        return value
    if digits.startswith("91") and len(digits) == 12:
        return f"0{digits[2:]}"
    if len(digits) == 10:
        return f"0{digits}"
    if not digits.startswith("0") and len(digits) == 11:
        return f"0{digits[-10:]}"
    return digits


def extract_exotel_sid(payload: dict[str, object]) -> str | None:
    call_sid = payload.get("CallSid") or payload.get("call_sid") or payload.get("callSid")
    if not call_sid and isinstance(payload.get("Call"), dict):
        nested = payload["Call"]
        call_sid = nested.get("Sid") or nested.get("CallSid")
    return str(call_sid) if call_sid else None


async def start_outbound_call(
    *,
    to_number: str,
    custom_field: str,
    timeout: int = 30,
) -> dict:
    if not is_exotel_configured():
        raise ExotelConfigError("Exotel is not fully configured")

    account_sid = settings.exotel_account_sid
    host = settings.exotel_api_host.strip()
    endpoint = f"https://{host}/v1/Accounts/{account_sid}/Calls/connect.json"
    payload = {
        "From": normalize_indian_phone_number(settings.exotel_caller_id),
        "To": normalize_indian_phone_number(to_number),
        "Url": _build_flow_url(),
        "StatusCallback": build_status_callback_url(),
        "StatusCallbackMethod": "POST",
        "CustomField": custom_field,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            endpoint,
            data=payload,
            auth=(settings.exotel_api_key, settings.exotel_api_token),
        )

    response.raise_for_status()
    data = response.json()
    call = data.get("Call") or data
    return {
        "sid": call.get("Sid") or call.get("CallSid"),
        "status": call.get("Status") or call.get("CallStatus"),
        "raw": data,
    }


def safe_host(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc or url

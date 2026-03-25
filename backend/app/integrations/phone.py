def normalize_phone_number(value: str | None) -> str | None:
    if not value:
        return value

    raw = value.strip()
    if raw.startswith("+"):
        digits = "".join(ch for ch in raw[1:] if ch.isdigit())
        return f"+{digits}" if digits else raw

    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return raw
    if len(digits) == 10:
        return f"+91{digits}"
    if digits.startswith("91") and len(digits) == 12:
        return f"+{digits}"
    if digits.startswith("0") and len(digits) == 11:
        return f"+91{digits[-10:]}"
    return f"+{digits}"


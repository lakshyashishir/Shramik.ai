from app.config import settings


def azure_dependency_summary() -> dict[str, bool]:
    return {
        "openai_configured": bool(settings.azure_openai_endpoint and settings.azure_openai_api_key),
        "speech_configured": bool(settings.azure_speech_key and settings.azure_speech_region),
        "storage_configured": bool(settings.azure_storage_connection_string),
    }

import json

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Shramik.ai API"
    env: str = "local"
    cors_origins: list[str] = ["http://localhost:3000"]
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = "gpt-4.1"
    azure_openai_api_key: str = ""
    azure_openai_api_version: str = "2025-04-01-preview"
    azure_speech_key: str = ""
    azure_speech_region: str = ""
    azure_storage_connection_string: str = ""
    sarvam_api_key: str = ""
    public_base_url: str = "http://localhost:8000"
    exotel_enabled: bool = False
    exotel_account_sid: str = ""
    exotel_api_key: str = ""
    exotel_api_token: str = ""
    exotel_api_host: str = "api.in.exotel.com"
    exotel_caller_id: str = ""
    exotel_app_id: str = ""
    exotel_app_flow_url: str = ""
    exotel_default_assignment: str = (
        "Worker explains their trade experience, tools, material handling, "
        "quality checks, and step-by-step work process over a phone interview."
    )

    model_config = SettingsConfigDict(
        env_prefix="API_",
        env_file=".env",
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            if stripped.startswith("["):
                try:
                    parsed = json.loads(stripped)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    pass
            return [item.strip() for item in stripped.split(",") if item.strip()]
        return value


settings = Settings()

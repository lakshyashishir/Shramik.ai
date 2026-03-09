from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Shramik.ai API"
    env: str = "local"
    cors_origins: list[str] = ["http://localhost:3000"]
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = ""
    azure_openai_api_key: str = ""
    azure_speech_key: str = ""
    azure_speech_region: str = ""
    azure_storage_connection_string: str = ""

    model_config = SettingsConfigDict(
        env_prefix="API_",
        env_file=".env",
        extra="ignore",
    )


settings = Settings()

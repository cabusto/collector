from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./dev.db"
    COLLECTOR_API_KEYS: str = ""  # comma-separated key:account_id pairs
    ALLOWED_ORIGINS: str = "*"


settings = Settings()

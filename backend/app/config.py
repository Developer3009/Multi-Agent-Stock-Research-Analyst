from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Union


class Settings(BaseSettings):
    APP_NAME: str = "Multi-Agent Stock Research Analyst"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DATABASE_URL: str = "sqlite+aiosqlite:///./stock_research.db"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"

    DEFAULT_MARKET: str = "NSE"

    NEWS_FEED_ET: str = "https://economictimes.indiatimes.com/markets/stocks/rss.cms"
    NEWS_FEED_MINT: str = "https://www.livemint.com/rss/markets"

    ALPHA_VANTAGE_API_KEY: str = "6OZCUO3WUNU0III9"

    ALLOWED_ORIGINS: Union[List[str], str] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                return json.loads(v)
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()


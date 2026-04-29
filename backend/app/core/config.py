from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PERPLEXITY_API_KEY: str
    ELEVENLABS_API_KEY: str
    OPENAI_API_KEY: str
    ANTHROPIC_API_KEY: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    NEO4J_URI: str = ""
    NEO4J_USERNAME: str = ""
    NEO4J_PASSWORD: str = ""
    ELEVENLABS_VOICE_ID: str = "cjVigY5qzO86Huf0OWal"
    ELEVENLABS_AGENT_ID: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

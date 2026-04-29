from pydantic import BaseModel, Field
from typing import Optional


class TopicRequest(BaseModel):
    topic_title: Optional[str] = None
    topic: Optional[str] = None  # simple string fallback from frontend
    global_context: Optional[str] = ""
    why_this_matters: Optional[str] = ""
    key_questions: list[str] = Field(default_factory=list)
    user_name: Optional[str] = "Guest"
    userName: Optional[str] = None  # support camelCase from frontend

    def get_topic_title(self) -> str:
        return self.topic_title or self.topic or "General Discussion"

    def get_user_name(self) -> str:
        return self.userName or self.user_name or "Guest"


class AgentDispatchRequest(BaseModel):
    interview_id: str


class ExtractRequest(BaseModel):
    interview_id: str
    transcript: str
    topic: Optional[str] = "General Discussion"


class LinkedInRequest(BaseModel):
    topic: str
    userName: Optional[str] = "Guest"
    transcript: str

class TwitterRequest(BaseModel):
    topic: str
    userName: Optional[str] = "Guest"
    transcript: str

class NewsletterRequest(BaseModel):
    topic: str
    userName: Optional[str] = "Guest"
    transcript: str

class ResearchRequest(BaseModel):
    keyword: str

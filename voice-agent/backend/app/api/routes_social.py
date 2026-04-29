from fastapi import APIRouter, Depends
from app.auth.auth_config import current_active_user
from app.schemas.requests import LinkedInRequest, TwitterRequest, NewsletterRequest
from app.services.linkedin_writer import generate_linkedin_post
from app.services.twitter_writer import generate_twitter_thread
from app.services.newsletter_writer import generate_newsletter_post
from app.services.rate_limiter import check_rate_limit

router = APIRouter()

@router.post("/generate-linkedin")
def generate_linkedin(req: LinkedInRequest, user=Depends(current_active_user)):
    check_rate_limit(user.id, "legacy_social_generate")
    post = generate_linkedin_post(
        topic=req.topic,
        user_name=req.userName or "Guest",
        transcript=req.transcript,
    )
    return {"linkedin": post}

@router.post("/generate-twitter")
def generate_twitter(req: TwitterRequest, user=Depends(current_active_user)):
    check_rate_limit(user.id, "legacy_social_generate")
    post = generate_twitter_thread(
        topic=req.topic,
        user_name=req.userName or "Guest",
        transcript=req.transcript,
    )
    return {"twitter": post}

@router.post("/generate-newsletter")
def generate_newsletter(req: NewsletterRequest, user=Depends(current_active_user)):
    check_rate_limit(user.id, "legacy_social_generate")
    post = generate_newsletter_post(
        topic=req.topic,
        user_name=req.userName or "Guest",
        transcript=req.transcript,
    )
    return {"newsletter": post}

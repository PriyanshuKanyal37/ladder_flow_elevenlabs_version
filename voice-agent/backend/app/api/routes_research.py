from fastapi import APIRouter, Depends, HTTPException
from app.auth.auth_config import current_active_user
from app.schemas.requests import ResearchRequest
from app.services.perplexity_service import research_topic
from app.services.rate_limiter import check_rate_limit

router = APIRouter()

@router.post("/research") # Stripped /api prefix here, will mount it in router.py
async def research_endpoint(request: ResearchRequest, user=Depends(current_active_user)):
    try:
        check_rate_limit(user.id, "research")
        print(f"Received research request for: {request.keyword}")
        result = research_topic(request.keyword)
        # Wrap result in "output" key to match frontend expectation
        return {"output": result}
    except Exception as e:
        print(f"Error in research endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

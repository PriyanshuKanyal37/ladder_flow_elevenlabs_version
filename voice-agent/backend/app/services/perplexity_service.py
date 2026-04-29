import requests
import json
from typing import Dict, Any, Optional
from app.core.config import settings

PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"
PERPLEXITY_MODEL = "sonar" 

def research_topic(keyword: str) -> Dict[str, Any]:
    """
    Research a topic using Perplexity API and return a single comprehensive context.
    """
    api_key = settings.PERPLEXITY_API_KEY
    if not api_key:
        raise ValueError("PERPLEXITY_API_KEY is not set in environment variables")
        
    from app.prompts.perplexity_prompt import PERPLEXITY_SYSTEM_PROMPT
    system_prompt = PERPLEXITY_SYSTEM_PROMPT
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": PERPLEXITY_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": f"Research this topic comprehensively: '{keyword}'"
            }
        ],
        "temperature": 0.7  # Slight creativity but grounded research
    }
    
    try:
        response = requests.post(PERPLEXITY_API_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        
        # Parse JSON from content (handle markdown code blocks if present)
        clean_content = content.strip()
        if clean_content.startswith("```json"):
            clean_content = clean_content[7:]
        if clean_content.endswith("```"):
            clean_content = clean_content[:-3]
        
        try:
             result_json = json.loads(clean_content.strip())
             return result_json
        except json.JSONDecodeError:
            # Fallback if AI didn't return valid JSON
            return {
                "title": f"Research on {keyword}",
                "deep_context": content,
                "key_insights": [],
                "contrarian_angles": [],
                "discussion_points": [],
                "sources": []
            }
            
    except requests.exceptions.RequestException as e:
        print(f"Perplexity API Request Error: {e}")
        raise e
    except Exception as e:
        print(f"Error in research_topic: {e}")
        raise e

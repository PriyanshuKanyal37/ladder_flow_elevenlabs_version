import random
from openai import OpenAI
from typing import Optional

def get_random_template(content_type: str, topic: str, base_rules: str) -> str:
    """Selects a random structural template based on content type."""
    from app.prompts.linkedin_prompt import (
        LINKEDIN_TEMPLATE_LINEAR_STORY,
        LINKEDIN_TEMPLATE_REVERSE_REVEAL,
        LINKEDIN_TEMPLATE_BEFORE_AFTER,
        LINKEDIN_TEMPLATE_VULNERABLE,
        LINKEDIN_TEMPLATE_PATTERN,
        LINKEDIN_TEMPLATE_MOMENT_CLARITY,
        LINKEDIN_TEMPLATE_PAS,
        LINKEDIN_TEMPLATE_CONTRARIAN,
        LINKEDIN_TEMPLATE_DEFAULT
    )
    
    rand = random.random()
    
    # PERSONAL STORY - 4 VARIATIONS
    if content_type == 'personal-story':
        if rand < 0.25:
            return LINKEDIN_TEMPLATE_LINEAR_STORY.format(topic=topic, base_rules=base_rules)
        elif rand < 0.5:
            return LINKEDIN_TEMPLATE_REVERSE_REVEAL.format(topic=topic, base_rules=base_rules)
        elif rand < 0.75:
            return LINKEDIN_TEMPLATE_BEFORE_AFTER.format(topic=topic, base_rules=base_rules)
        else:
            return LINKEDIN_TEMPLATE_VULNERABLE.format(topic=topic, base_rules=base_rules)
            
    # CAREER CHALLENGE - 4 VARIATIONS (Mapped to 'Professional Insight' for Podcast)
    elif content_type == 'career-challenge':
        if rand < 0.25:
            return LINKEDIN_TEMPLATE_PATTERN.format(topic=topic, base_rules=base_rules)
        elif rand < 0.5:
            return LINKEDIN_TEMPLATE_MOMENT_CLARITY.format(topic=topic, base_rules=base_rules)
        elif rand < 0.75:
            return LINKEDIN_TEMPLATE_PAS.format(topic=topic, base_rules=base_rules)
        else:
            return LINKEDIN_TEMPLATE_CONTRARIAN.format(topic=topic, base_rules=base_rules)
            
    # DEFAULT / FALLBACK
    else:
        return LINKEDIN_TEMPLATE_DEFAULT.format(topic=topic, base_rules=base_rules)


def generate_linkedin_post(topic: str, user_name: str, transcript: str, writing_style: str = "authentic, professional", content_type: Optional[str] = None) -> str:
    """
    Generate a viral LinkedIn post from podcast transcript using dynamic 'Nick Sarra' style templates.
    """
    from app.core.config import settings
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    # If content_type is not provided, randomly select one to ensure variety
    if not content_type:
        content_type = random.choice(['personal-story', 'career-challenge'])

    from app.prompts.linkedin_prompt import LINKEDIN_BASE_RULES
    base_rules = LINKEDIN_BASE_RULES.format(
        user_name=user_name,
        writing_style=writing_style,
        transcript=transcript
    )

    # Select the specific template structure
    final_prompt = get_random_template(content_type, topic, base_rules)

    completion = client.chat.completions.create(
        model="gpt-4o",  # Or 'gpt-4-turbo'
        messages=[
            {"role": "system", "content": "You are a LinkedIn ghostwriter who turns real interview insights into authentic, high-engagement posts. You write from the founder's voice — specific, experience-driven, never generic."},
            {"role": "user", "content": final_prompt}
        ],
        temperature=0.7, # Slightly lower temperature for consistency with transcript
        max_tokens=1000
    )

    return (completion.choices[0].message.content or "").strip()

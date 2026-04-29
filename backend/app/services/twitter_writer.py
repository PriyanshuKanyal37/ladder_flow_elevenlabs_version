import random
from openai import OpenAI
from typing import Optional

def get_twitter_template(topic: str, base_rules: str) -> str:
    """Selects a random structural template for a Twitter thread."""
    from app.prompts.twitter_prompt import (
        TWITTER_TEMPLATE_CONTRARIAN, TWITTER_TEMPLATE_TACTICAL,
        TWITTER_TEMPLATE_STORY, TWITTER_TEMPLATE_LISTICLE
    )

    templates = [
        TWITTER_TEMPLATE_CONTRARIAN,
        TWITTER_TEMPLATE_TACTICAL,
        TWITTER_TEMPLATE_STORY,
        TWITTER_TEMPLATE_LISTICLE,
    ]
    template = random.choice(templates)
    return template.format(topic=topic, base_rules=base_rules)


def generate_twitter_thread(topic: str, user_name: str, transcript: str) -> str:
    """
    Generate an engaging Twitter/X thread from a podcast transcript.
    """
    from app.core.config import settings
    # We use settings from core config for consistency
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    from app.prompts.twitter_prompt import TWITTER_BASE_RULES
    base_rules = TWITTER_BASE_RULES.format(user_name=user_name, transcript=transcript)

    final_prompt = get_twitter_template(topic, base_rules)

    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a Twitter/X ghostwriter who turns real interview insights into sharp, specific threads. You write for founders who value substance over engagement bait."},
            {"role": "user", "content": final_prompt}
        ],
        temperature=0.7,
        max_tokens=1500
    )

    return (completion.choices[0].message.content or "").strip()

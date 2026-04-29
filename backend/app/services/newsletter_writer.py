from openai import OpenAI
from typing import Optional

def generate_newsletter_post(topic: str, user_name: str, transcript: str) -> str:
    """
    Generate a long-form, engaging newsletter issue from a podcast transcript.
    """
    from app.core.config import settings
    # Use settings from core config for consistency
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    from app.prompts.newsletter_prompt import NEWSLETTER_PROMPT
    prompt = NEWSLETTER_PROMPT.format(user_name=user_name, transcript=transcript)

    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a newsletter writer who turns podcast interviews into deep, actionable issues. You write like a smart friend explaining what they learned — specific, useful, no filler."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=2500
    )

    return (completion.choices[0].message.content or "").strip()

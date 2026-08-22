import argparse
import json
import re
import sys


UNSAFE_DESCRIPTION_PATTERNS = [
    r"\b(kill(?:ing)?|murder(?:ing)?|stab(?:bing)?|shoot(?:ing)?|attack(?:ing)?|assault(?:ing)?)\b",
    r"\b(beat(?:ing)?|beat\s+up)\s+(?:my|your|his|her|their|our|the|a|an)?\s*(people|someone|others|kids|students|teachers?|myself|him|her|them)\b",
    r"\b(hurt(?:ing)?|harm(?:ing)?|injur(?:e|ing))\s+(?:my|your|his|her|their|our|the|a|an)?\s*(people|someone|others|kids|students|teachers?|myself|him|her|them)\b",
    r"\b(i\s+(like|want|plan|love)\s+to\s+(hurt|harm|kill|attack|shoot|stab|beat))\b",
    r"\b(self[-\s]?harm|suicide|suicidal)\b",
    r"\b(hate\s+(people|everyone|students|kids|women|men))\b",
    r"\b(bomb|weapon|gun|knife)\b",
    r"\bi\s+am\s+a\s+bad\s+person\b",
    r"\bi'?m\s+a\s+bad\s+person\b",
]

DETOXIFY_THRESHOLDS = {
    "toxicity": 0.82,
    "severe_toxicity": 0.45,
    "obscene": 0.75,
    "threat": 0.35,
    "insult": 0.75,
    "identity_attack": 0.65,
}

SAFETY_MESSAGE = (
    "Please write an event-appropriate description about your interests, "
    "strengths, or activities."
)


def regex_flags_text(text):
    return any(
        re.search(pattern, text, flags=re.IGNORECASE)
        for pattern in UNSAFE_DESCRIPTION_PATTERNS
    )


def run_detoxify(text):
    from detoxify import Detoxify

    model = Detoxify("original")
    scores = model.predict(text)
    triggered = {
        label: float(score)
        for label, score in scores.items()
        if float(score) >= DETOXIFY_THRESHOLDS.get(label, 1.0)
    }

    return scores, triggered


def check_text(text):
    if regex_flags_text(text):
        return {
            "safe": False,
            "message": SAFETY_MESSAGE,
            "source": "regex",
            "scores": {},
            "triggered": {"pattern": 1.0},
        }

    try:
        scores, triggered = run_detoxify(text)
    except Exception as error:
        return {
            "safe": True,
            "message": None,
            "source": "regex-fallback",
            "scores": {},
            "triggered": {},
            "warning": str(error),
        }

    return {
        "safe": not bool(triggered),
        "message": None if not triggered else SAFETY_MESSAGE,
        "source": "detoxify",
        "scores": {label: float(score) for label, score in scores.items()},
        "triggered": triggered,
    }


def main():
    parser = argparse.ArgumentParser(description="Check whether a booth description is safe.")
    parser.add_argument("--text", required=True)
    args = parser.parse_args()

    result = check_text(args.text.strip())
    print(json.dumps(result))

    if not result["safe"]:
        sys.exit(2)


if __name__ == "__main__":
    main()

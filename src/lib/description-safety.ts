const unsafeDescriptionPatterns = [
  /\b(kill(?:ing)?|murder(?:ing)?|stab(?:bing)?|shoot(?:ing)?|attack(?:ing)?|assault(?:ing)?)\b/i,
  /\b(beat(?:ing)?|beat\s+up)\s+(?:my|your|his|her|their|our|the|a|an)?\s*(people|someone|others|kids|students|teachers?|myself|him|her|them)\b/i,
  /\b(hurt(?:ing)?|harm(?:ing)?|injur(?:e|ing))\s+(?:my|your|his|her|their|our|the|a|an)?\s*(people|someone|others|kids|students|teachers?|myself|him|her|them)\b/i,
  /\b(i\s+(like|want|plan|love)\s+to\s+(hurt|harm|kill|attack|shoot|stab|beat))\b/i,
  /\b(self[-\s]?harm|suicide|suicidal)\b/i,
  /\b(hate\s+(people|everyone|students|kids|women|men))\b/i,
  /\b(bomb|weapon|gun|knife)\b/i,
];

const negativeIdentityPatterns = [
  /\bi\s+am\s+a\s+bad\s+person\b/i,
  /\bi'?m\s+a\s+bad\s+person\b/i,
];

export const unsafeDescriptionMessage =
  "Please write an event-appropriate description about your interests, strengths, or activities.";

export function isAppropriateDescription(description: string) {
  const normalized = description.trim();

  if (!normalized) {
    return true;
  }

  return ![...unsafeDescriptionPatterns, ...negativeIdentityPatterns].some((pattern) =>
    pattern.test(normalized),
  );
}

export function getDescriptionSafetyError(description: string) {
  return isAppropriateDescription(description) ? null : unsafeDescriptionMessage;
}

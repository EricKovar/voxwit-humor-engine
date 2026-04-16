export interface HookCandidate {
  structure: string;
  text: string;
  metadata?: Record<string, unknown>;
}

const BLOCKLIST = [
  /\bidiot\b/i,
  /\bstupid\b/i,
  /\bpolitic/i,
  /\belection/i,
  /\bnsfw\b/i,
  /\bkill/i,
  /\bdamn/i,
  /\bhell\b/i,
  /\bloser\b/i,
  /sarcasm/i,
  /\bsucks\b/i,
];

export function toneFilter(candidates: HookCandidate[]): HookCandidate[] {
  return candidates.filter((candidate) => {
    const trimmed = candidate.text.trim();
    const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
    const sentenceCountOk = sentences.length >= 1 && sentences.length <= 2;
    const hasNoBlocklistedTerms = !BLOCKLIST.some((pattern) => pattern.test(trimmed));
    const notNegative = !/(fire|blame|stupid|idiot|disaster)/i.test(trimmed);
    const professionalTone = !/(lol|lmao|wtf|haha)/i.test(trimmed);

    return sentenceCountOk && hasNoBlocklistedTerms && notNegative && professionalTone;
  });
}

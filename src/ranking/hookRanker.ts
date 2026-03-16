import { HookCandidate } from '../filters/toneFilter';

export interface RankedHook extends HookCandidate {
  score: number;
  breakdown: HookScoreBreakdown;
}

export interface HookScoreBreakdown {
  curiosity: number;
  clarity: number;
  relatability: number;
  brevity: number;
  professionalTone: number;
}

const WEIGHTS: HookScoreBreakdown = {
  curiosity: 0.25,
  clarity: 0.2,
  relatability: 0.25,
  brevity: 0.15,
  professionalTone: 0.15,
};

const curiosityKeywords = [/what if/i, /imagine/i, /turns out/i, /nobody/i, /yet/i, /still/i, /secret/i];
const pronouns = [/\byou\b/i, /\bwe\b/i, /\bthey\b/i, /leaders?/i, /teams?/i];
const professionalismPatterns = [/(please|thank you|let's)/i, /results?/i, /clients?/i];
const slangPatterns = [/(lol|haha|lmao|wtf|damn)/i];

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function scoreCuriosity(text: string): number {
  const punctBonus = text.includes('?') ? 0.2 : 0;
  const keywordHits = curiosityKeywords.reduce((sum, pattern) => (pattern.test(text) ? sum + 1 : sum), 0);
  return clamp(punctBonus + keywordHits / curiosityKeywords.length);
}

function scoreClarity(text: string): number {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const avgLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / (sentences.length || 1);
  const lengthScore = clamp(1 - (avgLength - 18) / 20);
  const jargonPenalty = /(synergy|ideation|low-hanging|leveraging)/i.test(text) ? 0.1 : 0;
  return clamp(lengthScore - jargonPenalty);
}

function scoreRelatability(text: string): number {
  const hits = pronouns.reduce((sum, pattern) => (pattern.test(text) ? sum + 1 : sum), 0);
  return clamp(hits / pronouns.length + 0.3);
}

function scoreBrevity(text: string): number {
  const maxChars = 220;
  const length = text.length;
  if (length >= maxChars) {
    return 0.2;
  }
  return clamp(1 - length / maxChars);
}

function scoreProfessionalTone(text: string): number {
  const slangPenalty = slangPatterns.some((pattern) => pattern.test(text)) ? 0.5 : 0;
  const positiveSignals = professionalismPatterns.reduce((sum, pattern) => (pattern.test(text) ? sum + 1 : sum), 0);
  return clamp(0.4 + positiveSignals * 0.2 - slangPenalty);
}

export function rankHooks(candidates: HookCandidate[]): RankedHook[] {
  const ranked = candidates.map((candidate) => {
    const breakdown: HookScoreBreakdown = {
      curiosity: scoreCuriosity(candidate.text),
      clarity: scoreClarity(candidate.text),
      relatability: scoreRelatability(candidate.text),
      brevity: scoreBrevity(candidate.text),
      professionalTone: scoreProfessionalTone(candidate.text),
    };

    const score = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
      const metric = breakdown[key as keyof HookScoreBreakdown];
      return sum + metric * weight;
    }, 0);

    return {
      ...candidate,
      score: Number(score.toFixed(3)),
      breakdown,
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

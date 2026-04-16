import OpenAI from 'openai';
import nlp from 'compromise';
import { loadPromptLibrary, PromptLibrary, PromptStructure } from '../prompts/promptLoader';
import { selectStructures } from './humorSelector';
import { toneFilter, HookCandidate } from '../filters/toneFilter';
import { rankHooks, RankedHook } from '../ranking/hookRanker';
import { Logger } from '../utils/logger';

export interface HookRequestBody {
  post_text: string;
  industry?: string;
  tone?: string;
  max_hooks?: number;
}

export interface HookResponseItem {
  structure: string;
  text: string;
  score: number;
}

interface ContentInsights {
  topic: string;
  themes: string[];
}

interface ContextPayload extends ContentInsights {
  industry: string;
  tone: string;
}

const MIN_HOOKS = 3;
const MAX_HOOKS = 6;
const STOPWORDS = new Set([
  'should',
  'teams',
  'their',
  'about',
  'early',
  'earlier',
  'still',
  'these',
  'those',
  'every',
  'thing',
  'people',
  'talk',
]);

type FrequencyEntry = { normal: string; count: number };

const STRUCTURE_EXAMPLES: Record<string, { input: string; hook: string }[]> = {
  'Truth Bomb': [
    {
      input: 'Founders ship big launches before ever interviewing a paying customer.',
      hook: 'Everyone says “launch fixes everything.” The real problem is that most teams launch before listening.',
    },
  ],
  'Corporate Translation': [
    {
      input: 'Leadership touts “customer centricity” while celebrating vanity metrics.',
      hook: 'Corporate translation: “customer centricity” = we noticed churn but made another dashboard instead.',
    },
  ],
  'Unexpected Analogy': [
    {
      input: 'RevOps keeps delaying onboarding fixes.',
      hook: 'Your onboarding is basically TSA: everyone queues, nobody feels welcome, and the best people look for another airport.',
    },
  ],
  'Reverse Forecast': [
    {
      input: 'Product teams want faster launches but ignore discovery.',
      hook: 'If you want faster launches, stop skipping the messy discovery calls.',
    },
  ],
  'Customer Reality Check': [
    {
      input: 'Customers keep asking for dashboards but actually want clarity.',
      hook: 'Customers asked for dashboards. What they really need is one brave insight that tells them what to do next.',
    },
  ],
  'LinkedIn Confessional': [
    {
      input: 'I assumed more AI features meant happier customers.',
      hook: 'I used to think more AI meant happier customers. Turns out they just wanted a human to answer sooner.',
    },
  ],
  'Data Whisper': [
    {
      input: 'Win rate looks fine but no one renews.',
      hook: 'Metric says 34% win rate. Translation: your pipeline is a cul-de-sac if renewals keep ghosting.',
    },
  ],
};

export class HookGenerator {
  private readonly promptLibrary: PromptLibrary;

  private readonly logger: Logger;

  private readonly openAIClient: OpenAI | null;

  private readonly openAIModel: string;

  constructor(logger: Logger) {
    this.promptLibrary = loadPromptLibrary();
    this.logger = logger;
    const apiKey = process.env.OPENAI_API_KEY;
    this.openAIClient = apiKey ? new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL,
    }) : null;
    this.openAIModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  async generate(payload: HookRequestBody): Promise<HookResponseItem[]> {
    const targetHooks = this.determineTargetCount(payload.max_hooks);
    const context = this.buildContext(payload.post_text, payload.industry, payload.tone);
    const structures = selectStructures(this.promptLibrary, targetHooks * 4);

    const hookCandidates: HookCandidate[] = [];

    for (const structure of structures) {
      const hookText = await this.generateHookText(structure, context).catch((error) => {
        this.logger.warn('LLM hook generation failed, falling back to template', { error: (error as Error).message });
        return null;
      });

      const text = hookText ?? this.composeTemplateHook(structure, context);
      hookCandidates.push({ structure: structure.name, text });

      if (hookCandidates.length >= targetHooks * 2) {
        break;
      }
    }

    const filtered = toneFilter(hookCandidates);
    const unique = this.ensureMinimumHooks(this.deduplicate(filtered), targetHooks, context);
    const ranked = rankHooks(unique);
    const topHooks = ranked.slice(0, targetHooks).map(this.toResponseItem);

    this.logger.info('Hook generation complete', {
      requested: payload.max_hooks,
      delivered: topHooks.length,
      postLength: payload.post_text.length,
    });

    return topHooks;
  }

  private determineTargetCount(requested?: number): number {
    if (!requested) {
      return MAX_HOOKS;
    }
    return Math.max(MIN_HOOKS, Math.min(MAX_HOOKS, requested));
  }

  private buildContext(postText: string, industry?: string, tone?: string): ContextPayload {
    const insights = this.extractInsights(postText);
    return {
      ...insights,
      industry: industry ?? 'LinkedIn leaders',
      tone: tone ?? 'professional',
    };
  }

  private extractInsights(postText: string): ContentInsights {
    const sanitized = postText.replace(/\s+/g, ' ').trim();
    if (!sanitized) {
      return { topic: 'Share the tension between what teams say and what customers feel.', themes: ['customer insight'] };
    }

    const doc = nlp(postText);
    const sentences = doc.sentences().out('array');

    const nounFrequency = doc.nouns().out('frequency') as FrequencyEntry[];
    const nounThemes = nounFrequency
      .map((entry) => this.normalizeTheme(entry.normal))
      .filter((value): value is string => Boolean(value));

    const legacyKeywords = this.extractLegacyKeywords(sanitized);
    const themes = this.uniqueList([...nounThemes, ...legacyKeywords]).slice(0, 8);

    const topic = sentences[0] ?? sanitized.split(/(?<=[.!?])\s+/)[0] ?? sanitized;

    return {
      topic,
      themes: themes.length ? themes : legacyKeywords.slice(0, 5),
    };
  }

  private extractLegacyKeywords(text: string): string[] {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(' ').filter(Boolean);
    const frequency = new Map<string, number>();
    for (const word of words) {
      if (word.length <= 3) continue;
      if (STOPWORDS.has(word)) continue;
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 8);
  }

  private normalizeTheme(phrase: string): string | null {
    if (!phrase) {
      return null;
    }
    const cleaned = phrase.replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 3) {
      return null;
    }
    if (STOPWORDS.has(cleaned)) {
      return null;
    }
    return cleaned;
  }

  private uniqueList(values: (string | null | undefined)[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }

    return result;
  }

  private async generateHookText(structure: PromptStructure, context: ContextPayload): Promise<string | null> {
    if (!this.openAIClient) {
      return null;
    }

    const examples = STRUCTURE_EXAMPLES[structure.name] ?? [];
    const exampleBlock = examples
      .map((example, index) => `Example ${index + 1}:\nInput: ${example.input}\nHook: ${example.hook}`)
      .join('\n');

    const response = await this.openAIClient.chat.completions.create({
      model: this.openAIModel,
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You craft concise, high-signal LinkedIn hooks that feel clever, confident, and safe for executives.',
        },
        {
          role: 'user',
          content: `Task: Write exactly one ${structure.name} style hook (1-2 sentences).\n` +
            `Keep it professional, clever-not-goofy, LinkedIn-safe, and rooted in the user's post.\n` +
            `Return JSON: {"hook": "text"}. Nothing else.\n\n` +
            `Structure template: ${structure.prompt}\n` +
            `Topic: ${context.topic}\n` +
            `Themes: ${context.themes.join(', ') || 'n/a'}\n` +
            `Industry: ${context.industry}\n` +
            `Tone: ${context.tone}\n` +
            `Rules: ${this.promptLibrary.rules.join(' | ')}\n` +
            (exampleBlock ? `\n${exampleBlock}\n` : ''),
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    try {
      const parsed = JSON.parse(content) as { hook?: string };
      return parsed.hook ?? null;
    } catch (error) {
      this.logger.warn('Failed to parse LLM response', { error: (error as Error).message });
      return null;
    }
  }

  private composeTemplateHook(structure: PromptStructure, context: ContextPayload): string {
    const primary = this.pickTheme(context.themes, context.topic);
    const secondary = this.pickTheme(
      context.themes.filter((theme) => theme !== primary),
      context.industry,
    );

    const base = structure.prompt
      .replace(/X/g, primary)
      .replace(/Y/g, secondary);

    const normalizedBase = /[.!?]$/.test(base) ? base : `${base}.`;
    const nuanceTemplates = [
      `${this.capitalize(context.industry)} leaders keep saying "${this.truncate(context.topic)}" yet the quiet win is ${secondary}.`,
      `${this.capitalize(context.industry)} teams brag about ${primary}, but users sign up for whoever fixes ${secondary}.`,
      `If ${this.capitalize(context.industry)} operators wait on ${secondary}, the launch becomes an apology tour.`,
      `${this.capitalize(context.industry)} pros know ${secondary} is the KPI hiding under the ${primary} hype.`,
    ];
    const nuance = nuanceTemplates[Math.floor(Math.random() * nuanceTemplates.length)];

    return `${normalizedBase} ${nuance}`.trim();
  }

  private pickTheme(themes: string[], fallback: string): string {
    if (themes.length === 0) {
      return fallback;
    }
    const index = Math.floor(Math.random() * themes.length);
    return themes[index] ?? fallback;
  }

  private truncate(text: string, max = 80): string {
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  private capitalize(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private ensureMinimumHooks(
    candidates: HookCandidate[],
    target: number,
    context: ContextPayload,
  ): HookCandidate[] {
    if (candidates.length >= target) {
      return candidates;
    }

    const shortfall = target - candidates.length;
    const supplemental = this.generateSupplementalHooks(shortfall * 2, context);
    return this.deduplicate([...candidates, ...supplemental]).slice(0, target);
  }

  private generateSupplementalHooks(count: number, context: ContextPayload): HookCandidate[] {
    const hooks: HookCandidate[] = [];
    const structures = this.promptLibrary.structures;
    for (let i = 0; i < count; i += 1) {
      const structure = structures[i % structures.length] ?? structures[0];
      if (!structure) {
        break;
      }
      hooks.push({
        structure: structure.name,
        text: this.composeTemplateHook(structure, context),
      });
    }
    return hooks;
  }

  private deduplicate(candidates: HookCandidate[]): HookCandidate[] {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      const key = `${candidate.structure}-${candidate.text.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private toResponseItem(hook: RankedHook): HookResponseItem {
    return {
      structure: hook.structure,
      text: hook.text,
      score: hook.score,
    };
  }
}

import { PromptLibrary, PromptStructure } from '../prompts/promptLoader';

const STRUCTURE_WEIGHTS: Record<string, number> = {
  'Truth Bomb': 0.25,
  'Corporate Translation': 0.2,
  'Unexpected Analogy': 0.2,
  'Reverse Forecast': 0.12,
  'Customer Reality Check': 0.1,
  'LinkedIn Confessional': 0.08,
  'Data Whisper': 0.05,
};

const DEFAULT_WEIGHT = 0.05;

function getWeight(structure: PromptStructure): number {
  return STRUCTURE_WEIGHTS[structure.name] ?? DEFAULT_WEIGHT;
}

export function selectStructures(
  library: PromptLibrary,
  desiredCount: number,
): PromptStructure[] {
  const pool = library.structures;
  if (pool.length === 0) {
    return [];
  }

  const selections: PromptStructure[] = [];
  for (let i = 0; i < desiredCount; i += 1) {
    const totalWeight = pool.reduce((sum, structure) => sum + getWeight(structure), 0);
    const threshold = Math.random() * totalWeight;
    let cumulative = 0;

    for (const structure of pool) {
      cumulative += getWeight(structure);
      if (threshold <= cumulative) {
        selections.push(structure);
        break;
      }
    }
  }

  return selections;
}

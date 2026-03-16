import fs from 'fs';
import path from 'path';

export interface PromptStructure {
  name: string;
  prompt: string;
}

export interface PromptLibrary {
  version: string;
  structures: PromptStructure[];
  rules: string[];
}

let cachedLibrary: PromptLibrary | null = null;

export function loadPromptLibrary(relativePath = 'humor-engine-prompt-library.json'): PromptLibrary {
  if (cachedLibrary) {
    return cachedLibrary;
  }

  const absolutePath = path.resolve(process.cwd(), relativePath);
  const fileContents = fs.readFileSync(absolutePath, 'utf-8');
  const parsed = JSON.parse(fileContents) as PromptLibrary;

  if (!parsed.structures || parsed.structures.length === 0) {
    throw new Error('Prompt library must include at least one structure.');
  }

  cachedLibrary = parsed;
  return parsed;
}

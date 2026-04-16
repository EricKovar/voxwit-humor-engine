# VoxWit Humor Engine

A Fastify-based microservice that generates high-engagement LinkedIn hooks using structured humor patterns and the VoxWit prompt library.

## Features
- Node.js + TypeScript + Fastify API server
- OpenAPI-driven `POST /generate-hooks`
- LLM-backed hook generation with template fallback (OpenAI-compatible)
- Modular pipeline: parser → selector → generator → tone filter → ranker
- Returns 3–6 clever, professional hooks under 3 seconds

## Getting Started

```bash
npm install
npm run dev
```

The dev server listens on `http://localhost:4000`. In another terminal:

```bash
curl -X POST http://localhost:4000/generate-hooks \
  -H "Content-Type: application/json" \
  -d '{
    "post_text": "Product teams should talk to customers earlier.",
    "industry": "SaaS",
    "tone": "professional",
    "max_hooks": 4
  }'
```

### Environment Variables

- `OPENAI_API_KEY` (required for live LLM generation)
- `OPENAI_BASE_URL` (optional override for compatible providers)
- `OPENAI_MODEL` (defaults to `gpt-4o-mini`)
- `PORT` (defaults to `4000`)

Copy `.env.example` to `.env` and fill in your OpenAI credentials so the LLM-powered path is enabled automatically. Without an API key, the service gracefully falls back to deterministic template synthesis while still honoring the humor structures and tone rules.

## Project Layout

```
voxwit-humor-engine/
  server.ts          # Fastify bootstrap + OpenAPI wiring
  humor-engine-openapi.yaml
  humor-engine-prompt-library.json
  src/
    api/generateHooks.ts
    engine/
      hookGenerator.ts
      humorSelector.ts
    prompts/promptLoader.ts
    filters/toneFilter.ts
    ranking/hookRanker.ts
    utils/logger.ts
```

## Front-end demo UI

An investor-friendly browser UI lives in `humor-engine-ui/` (Vite + React).

```bash
cd humor-engine-ui
npm install   # first run only
npm run dev   # launches on http://localhost:5173 with proxy to :4000
```

Paste a LinkedIn draft into the textarea and the page will call `POST /generate-hooks`, render the hooks as cards, and keep a rolling log of requests for demos.

## Production Build

```bash
npm run build
npm start
```

This compiles TypeScript into `dist/` and runs the optimized Fastify server.

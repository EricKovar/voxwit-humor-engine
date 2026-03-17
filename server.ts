import 'dotenv/config';
import Fastify from 'fastify';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import YAML from 'yaml';
import { registerGenerateHooksRoute } from './src/api/generateHooks';
import { HookGenerator } from './src/engine/hookGenerator';
import { createLogger } from './src/utils/logger';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';

const fastify = Fastify({ logger: true });
const logger = createLogger();
const generator = new HookGenerator(logger);

function loadOpenApiSpec() {
  const specPath = path.resolve(process.cwd(), 'humor-engine-openapi.yaml');
  const yamlContent = fs.readFileSync(specPath, 'utf-8');
  return YAML.parse(yamlContent);
}

const spec = loadOpenApiSpec();
const routeSpec = spec.paths?.['/generate-hooks']?.post ?? {};
const bodySchema = routeSpec?.requestBody?.content?.['application/json']?.schema;
const responseSchema = routeSpec?.responses?.['200']?.content?.['application/json']?.schema;
const WAITLIST_FILE = path.resolve(process.cwd(), 'data/waitlist.csv');
const EMAIL_REGEX =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;

registerGenerateHooksRoute(fastify, {
  generator,
  schema: {
    body: bodySchema,
    response: {
      200: responseSchema,
    },
  },
});

fastify.post('/waitlist', async (request, reply) => {
  const { email, source } = request.body as { email?: string; source?: string };

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return reply.status(400).send({ error: 'A valid email is required.' });
  }

  const normalizedEmail = email.toLowerCase();
  const line = `${new Date().toISOString()},${normalizedEmail},${source ?? 'voxwit.com'}\n`;

  try {
    await fsPromises.mkdir(path.dirname(WAITLIST_FILE), { recursive: true });
    await fsPromises.appendFile(WAITLIST_FILE, line, 'utf8');
    logger.info(`Waitlist joined: ${normalizedEmail}`);
    return { success: true };
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Unable to save your email right now. Please try again.' });
  }
});

fastify.get('/', async (_, reply) => {
  return reply.type('text/html').send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>VoxWit Humor Engine</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1116; color: #f1f5f9; margin: 0; padding: 3rem; }
          .card { max-width: 600px; margin: 0 auto; padding: 2rem; border-radius: 1.5rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); }
          a { color: #7dd3fc; }
          code { background: rgba(255,255,255,0.08); padding: 0.15rem 0.3rem; border-radius: 0.4rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🧠 VoxWit Humor Engine API</h1>
          <p>The Fastify backend is live on <code>https://voxwit-humor-engine.onrender.com</code>.</p>
          <ol>
            <li>Call <code>POST /generate-hooks</code> with your LinkedIn draft to get JSON hooks.</li>
            <li>Or open the demo UI at <a href="https://voxwit.com" target="_blank" rel="noreferrer">voxwit.com</a> for a live walkthrough.</li>
          </ol>
          <p>Example request:</p>
          <pre>{ "post_text": "Product teams should talk to customers earlier." }</pre>
        </div>
      </body>
    </html>
  `);
});

async function start() {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    logger.info(`🚀 VoxWit Humor Engine running on http://${HOST}:${PORT}`);
  } catch (error) {
    logger.error(error as Error);
    process.exit(1);
  }
}

start();

import { FastifyInstance } from 'fastify';
import { HookGenerator, HookRequestBody } from '../engine/hookGenerator';

interface RouteOptions {
  generator: HookGenerator;
  schema?: {
    body?: Record<string, unknown>;
    response?: Record<number, unknown>;
  };
}

export function registerGenerateHooksRoute(app: FastifyInstance, options: RouteOptions) {
  const { generator, schema } = options;

  app.post<{ Body: HookRequestBody }>('/generate-hooks', {
    schema: {
      body: schema?.body,
      response: schema?.response,
    },
  }, async (request, reply) => {
    const { post_text: postText } = request.body;

    if (!postText || typeof postText !== 'string') {
      return reply.code(400).send({ error: 'post_text is required' });
    }

    const hooks = await generator.generate(request.body);
    return { hooks };
  });
}

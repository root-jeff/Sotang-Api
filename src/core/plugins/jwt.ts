import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config';

export interface JwtPayload {
  sub: string;   // userId
  email: string;
  type: 'access' | 'refresh';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    verifyJWT: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyInternal: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  });

  fastify.decorate('verifyJWT', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      if (request.user.type !== 'access') {
        return reply.status(401).send({ error: 'invalid_token_type' });
      }
    } catch {
      return reply.status(401).send({ error: 'unauthorized' });
    }
  });

  fastify.decorate('verifyInternal', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.headers['x-internal-key'];
    if (key !== env.INTERNAL_API_KEY) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
  });
});

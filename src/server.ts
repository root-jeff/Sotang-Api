import { buildApp } from './app';
import { env } from './core/config';
import { closePool } from './core/db';

async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 sotang-api running on ${env.HOST}:${env.PORT}`);
    app.log.info(`📖 Swagger UI → http://localhost:${env.PORT}/documentation`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

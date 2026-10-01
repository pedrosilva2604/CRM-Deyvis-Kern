import { createServer } from 'node:http';
import { env } from '@/config/env';
import { app, leadImportQueue, prisma, queueRedisClient, realtimeEventRelay, socketGateway } from '@/container';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const httpServer = createServer(app.express);
socketGateway.attachToServer(httpServer);
await realtimeEventRelay.start();

httpServer.listen(env.PORT, () => {
  console.log(`API rodando em http://localhost:${env.PORT}/api`);
});

let shutdownInProgress = false;

async function shutDownGracefully(reason: string, exitCode: number): Promise<void> {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  console.log(`Encerrando a API (${reason})...`);

  const forcedExitTimer = setTimeout(() => {
    console.error(`A API não encerrou em ${SHUTDOWN_TIMEOUT_MS / 1000}s, forçando a saída.`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forcedExitTimer.unref();

  await socketGateway.closeSocketsAndHttpServer();
  await realtimeEventRelay.close();
  await leadImportQueue.close();
  await queueRedisClient.quit();
  await prisma.$disconnect();
  process.exit(exitCode);
}

process.once('SIGTERM', () => void shutDownGracefully('SIGTERM', 0));
process.once('SIGINT', () => void shutDownGracefully('SIGINT', 0));

process.on('unhandledRejection', (reason) => {
  console.error('Promise rejeitada sem tratamento:', reason);
  void shutDownGracefully('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  console.error('Erro não tratado:', error);
  void shutDownGracefully('uncaughtException', 1);
});

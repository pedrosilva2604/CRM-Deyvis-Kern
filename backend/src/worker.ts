import { env } from '@/config/env';
import {
  leadImportQueue,
  leadImportWorker,
  maintenanceScheduler,
  maintenanceWorker,
  prisma,
  workerRedisClient,
} from '@/worker-container';

const SHUTDOWN_TIMEOUT_MS = 30_000;

await maintenanceScheduler.registerSchedules();
console.log(
  `Worker de importação rodando (${env.LEAD_IMPORT_WORKER_CONCURRENCY} importações ao mesmo tempo); ` +
    `conciliador a cada ${env.LEAD_IMPORT_RECONCILE_EVERY_MS / 60_000} min, manutenção diária em "${env.MAINTENANCE_CRON}" (${env.APP_TIME_ZONE})`,
);

let shutdownInProgress = false;

async function shutDownGracefully(reason: string, exitCode: number): Promise<void> {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  console.log(`Encerrando o worker (${reason}), terminando o pedaço em andamento...`);

  const forcedExitTimer = setTimeout(() => {
    console.error(`O worker não encerrou em ${SHUTDOWN_TIMEOUT_MS / 1000}s, forçando a saída.`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forcedExitTimer.unref();

  await leadImportWorker.close();
  await maintenanceWorker.close();
  await maintenanceScheduler.close();
  await leadImportQueue.close();
  await workerRedisClient.quit();
  await prisma.$disconnect();
  process.exit(exitCode);
}

process.once('SIGTERM', () => void shutDownGracefully('SIGTERM', 0));
process.once('SIGINT', () => void shutDownGracefully('SIGINT', 0));

process.on('unhandledRejection', (reason) => {
  console.error('Promise rejeitada sem tratamento no worker:', reason);
  void shutDownGracefully('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  console.error('Erro não tratado no worker:', error);
  void shutDownGracefully('uncaughtException', 1);
});

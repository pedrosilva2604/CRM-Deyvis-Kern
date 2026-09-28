import { createServer } from 'node:http';
import { env } from '@/config/env';
import { app, socketGateway } from '@/container';

const server = createServer(app.express);
socketGateway.attachToServer(server);

server.listen(env.PORT, () => {
  console.log(`API rodando em http://localhost:${env.PORT}/api`);
});

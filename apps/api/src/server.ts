import { createServer } from 'node:http';
import { databasePool } from './postgres.js';
import { handleHttp } from './http.js';

export async function createRelay() {
  const httpServer = createServer((req, res) => {
    const handle = async () => {
      if ((req.url ?? '').split('?')[0] === '/health') {
        await databasePool().query('SELECT 1');
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: true }));
      } else if (!(await handleHttp(req, res))) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'route_not_found' }));
      }
    };
    void handle().catch(() => {
      if (!res.headersSent) res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
    });
  });
  return { httpServer, close: async () => {
    await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()));
  } };
}

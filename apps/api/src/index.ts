import { createRelay } from './server.js';
import { closeDb } from './postgres.js';

const relay = await createRelay();
const port = Number(process.env.PORT ?? 3001);
relay.httpServer.listen(port, () => console.log(`[relay] listening on :${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void relay.close().then(closeDb).finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

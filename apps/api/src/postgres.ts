import pg from 'pg';

const pools = new Map<string, pg.Pool>();
const checkedOut = new WeakSet<pg.PoolClient>();
const interruptionListeners = new Set<() => void>();
export function onDatabaseInterruption(listener: () => void): () => void {
  interruptionListeners.add(listener);
  return () => { interruptionListeners.delete(listener); };
}
function interrupted(): void {
  console.error('[postgres] connection interrupted');
  for (const listener of interruptionListeners) listener();
}

export function databasePool(direct = false): pg.Pool {
  const key = direct ? 'DATABASE_URL_UNPOOLED' : 'DATABASE_URL';
  const url = process.env[key];
  if (!url) throw new Error(`Missing required env var ${key}`);
  if (direct && new URL(url).hostname.includes('-pooler')) {
    throw new Error('DATABASE_URL_UNPOOLED must be a direct PostgreSQL connection');
  }
  let pool = pools.get(key);
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: direct ? 3 : 4, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 });
    pool.on('acquire', (client) => checkedOut.add(client));
    pool.on('release', (_error, client) => checkedOut.delete(client));
    pool.on('error', interrupted);
    // LISTEN clients remain checked out; pg.Pool's idle-client handler does not
    // catch their errors. Handle them explicitly and force application rejoin.
    pool.on('connect', (client) => {
      client.on('error', interrupted);
      client.on('end', () => {
        // The adapter reconnects its LISTEN subscription after end, but does not
        // release the ended checked-out client. Evict it to avoid pool exhaustion.
        if (checkedOut.has(client)) client.release(true);
      });
    });
    pools.set(key, pool);
  }
  return pool;
}

export async function transaction<T>(action: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await databasePool().connect();
  try {
    // A suspended function must never leave a row lock held indefinitely.
    await client.query(`BEGIN;
      SET LOCAL idle_in_transaction_session_timeout = '5s';
      SET LOCAL lock_timeout = '3s';
      SET LOCAL statement_timeout = '10s'`);
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* PostgreSQL may already have ended the connection. */ }
    throw error;
  } finally {
    if (checkedOut.has(client)) client.release();
  }
}

export async function closeDb(): Promise<void> {
  await Promise.all([...pools.values()].map((pool) => pool.end()));
  pools.clear();
}

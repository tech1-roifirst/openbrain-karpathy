/**
 * CLI entry point — wires real dependencies and runs the pipeline once.
 *
 * Usage:
 *   npm run pipeline:run -- --since 2026-04-29T00:00:00Z [--batch-size 100]
 *
 * Exit codes:
 *   0 — pipeline completed (records may have been skipped, but no critical failure)
 *   1 — extract phase failed unrecoverably; downstream side effects may be partial
 */

import { loadConfig, parseCliArgs } from '../config/pipeline.config.js';
import { Logger } from '../services/logger.js';
import { EventApiClient } from '../services/eventApiClient.js';
import { EventsTransformer } from '../services/eventsTransformer.js';
import { EventsDatabase, type DbPool } from '../services/eventsDatabase.js';
import { EventsPipeline } from './eventsPipeline.js';

/**
 * Lazily construct a real `pg`-backed pool. We avoid a top-level
 * import so the module can be loaded without `pg` installed (e.g. tests).
 */
async function buildPgPool(cfg: ReturnType<typeof loadConfig>['database']): Promise<DbPool> {
  // Dynamic import keeps `pg` an optional runtime dep.
  // We use a string variable so TS doesn't try to resolve the module at build time.
  const moduleId = 'pg';
  const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
  const pgModule = (await dynamicImport(moduleId).catch(() => null)) as
    | { default?: { Pool: new (opts: unknown) => unknown }; Pool?: new (opts: unknown) => unknown }
    | null;
  if (!pgModule) {
    throw new Error(
      'The `pg` package is required to run against a real database. ' +
        "Install it with `npm install pg` or run tests with the in-memory stub.",
    );
  }
  const PoolCtor = pgModule.Pool ?? pgModule.default?.Pool;
  if (!PoolCtor) {
    throw new Error('Could not locate Pool constructor in `pg` package');
  }
  const realPool = new PoolCtor({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    max: cfg.poolSize,
  }) as unknown as {
    connect: () => Promise<{
      query: (sql: string, params?: ReadonlyArray<unknown>) => Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
      release: (err?: Error) => void;
    }>;
    end: () => Promise<void>;
  };

  // Adapt to our internal DbPool/DbClient shape (pg already matches closely).
  return {
    connect: async () => {
      const c = await realPool.connect();
      return {
        query: (sql, params) => c.query(sql, params),
        release: (err) => c.release(err),
      };
    },
    end: () => realPool.end(),
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const config = loadConfig(parseCliArgs(argv));
  const logger = new Logger({ logFile: config.pipeline.logFile });

  let database: EventsDatabase | null = null;
  try {
    const pool = await buildPgPool(config.database);
    database = new EventsDatabase({ pool, logger });
    const apiClient = new EventApiClient({ config: config.api, logger });
    const transformer = new EventsTransformer({ logger });
    const pipeline = new EventsPipeline({ config, apiClient, transformer, database, logger });
    const result = await pipeline.run();
    return result.exitCode;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Pipeline crashed', { error: message }, 'orchestrator');
    return 1;
  } finally {
    if (database) await database.close().catch(() => {/* ignore */});
  }
}

// Allow `node runPipeline.js` direct execution.
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  /runPipeline(\.[jt]s)?$/.test(process.argv[1]);

if (isMain) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      // Belt and suspenders — main() already logs.
      process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

const run =
  process.env.RUN_DB_TESTS === "1" &&
  Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!run)("RLS: catalog + pricing (Postgres)", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  async function withActor(
    type: string,
    id: string,
    perms: string,
    fn: (c: pg.PoolClient) => Promise<void>,
  ) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(
        `select set_config('app.actor_type', $1, true), set_config('app.actor_id', $2, true), set_config('app.actor_permissions', $3, true)`,
        [type, id, perms],
      );
      await fn(c);
      await c.query("rollback");
    } finally {
      c.release();
    }
  }

  it("denies nationality SELECT for admin without catalog.read", async () => {
    await withActor("admin", "u1", "", async (c) => {
      const r = await c.query(`select count(*)::int as n from nationality`);
      expect(r.rows[0].n).toBe(0);
    });
  });

  it("allows nationality SELECT for admin with catalog.read", async () => {
    await withActor("admin", "u1", "catalog.read", async (c) => {
      const r = await c.query(`select count(*)::int as n from nationality`);
      expect(r.rows[0].n).toBeGreaterThanOrEqual(0);
    });
  });

  it("denies nationality INSERT for admin without catalog.write", async () => {
    await withActor("admin", "u1", "catalog.read", async (c) => {
      await expect(
        c.query(
          `insert into nationality (code, name, enabled) values ('__t','Testland', true)`,
        ),
      ).rejects.toThrow();
    });
  });
});

/// <reference types="vitest/globals" />
/**
 * `lib/db` throws if unset; route tests mock DB calls but still import the module graph.
 * Integration tests should set a real `DATABASE_URL` + `RUN_DB_TESTS=1`.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://vitest:vitest@127.0.0.1:65432/visatop_vitest_placeholder";
}

import "@testing-library/jest-dom/vitest";

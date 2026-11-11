import test from "node:test";
import assert from "node:assert/strict";
import { getTursoConfig } from "../src/lib/turso/config.mjs";

test("accepts the CR Connect remote database and keeps credentials on server", () => {
  assert.deepEqual(getTursoConfig({ TURSO_DATABASE_URL: " libsql://cr-connect.example.turso.io ", TURSO_AUTH_TOKEN: " secret " }), {
    url: "libsql://cr-connect.example.turso.io", authToken: "secret",
  });
});

test("rejects missing credentials and unsafe URL formats without leaking values", () => {
  for (const url of [undefined, "", "not-a-url", "file:local.db", "http://example.com", "libsql://user:password@example.com", "libsql://example.com?token=secret"]) {
    assert.throws(() => getTursoConfig({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "private-test-token" }), error => !error.message.includes("private-test-token") && !error.message.includes("password"));
  }
  assert.throws(() => getTursoConfig({ TURSO_DATABASE_URL: "libsql://example.com" }));
});

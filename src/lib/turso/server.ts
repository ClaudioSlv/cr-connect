import "server-only";
import { createClient, type Client } from "@libsql/client/web";
import { getTursoConfig } from "./config.mjs";

let client: Client | undefined;

/** Server only. Call after verifying the user and their workshop membership. */
export function getTursoClient(): Client {
  client ??= createClient(getTursoConfig());
  return client;
}

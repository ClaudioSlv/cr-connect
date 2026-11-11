/** Validate server credentials without including their values in errors. */
export function getTursoConfig(env = process.env) {
  const url = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) {
    throw new Error("Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no servidor.");
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TURSO_DATABASE_URL deve ser um endereço libsql:// válido.");
  }
  if (parsed.protocol !== "libsql:" || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== "/")) {
    throw new Error("TURSO_DATABASE_URL deve ser um endereço libsql:// válido.");
  }
  return { url, authToken };
}

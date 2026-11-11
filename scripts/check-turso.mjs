import { createClient } from "@libsql/client/web";
import { getTursoConfig } from "../src/lib/turso/config.mjs";

let client;
try {
  client = createClient(getTursoConfig());
  await client.execute("SELECT 1 AS connected");
  console.log("Conexão com o Turso confirmada. Nenhum dado foi alterado.");
} catch {
  // Provider errors can contain request URLs or credentials. Do not log them.
  console.error("Não foi possível validar o Turso. Confira as variáveis e o acesso ao banco.");
  process.exitCode = 1;
} finally {
  client?.close();
}

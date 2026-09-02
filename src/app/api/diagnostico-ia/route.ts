import { createClient } from "@/lib/supabase/server";
import { findDtcReference, formatDtcReference } from "@/lib/dtc-catalog";

export async function POST(request: Request) {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const { symptom, vehicle, mode } = await request.json();
  if (typeof symptom !== "string" || symptom.trim().length < (mode === "dtc" ? 4 : 8)) return Response.json({ error: mode === "dtc" ? "Informe um código DTC válido." : "Descreva o sintoma com mais detalhes." }, { status: 400 });
  const dtcCode = symptom.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const localReference = mode === "dtc" ? findDtcReference(dtcCode) : null;
  if (localReference) return Response.json({ answer: formatDtcReference(localReference, vehicle) });
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "A consulta técnica está temporariamente indisponível. Tente novamente em alguns instantes." }, { status: 503 });
  const prompt = mode === "dtc" ? `Atue como consultor técnico automotivo. Veículo: ${vehicle || "não informado"}. Código DTC: ${dtcCode}. Identifique se o código é genérico ou específico. Responda em português, sem mencionar inteligência artificial ou provedor, nas seções: Código e descrição; Significado para o veículo; Causas prováveis; Testes recomendados; Atenção. Se variar por fabricante, declare a limitação e não invente a posição do componente.` : mode === "technical" ? `Você é um assistente de procedimentos de oficina automotiva no Brasil. Veículo: ${vehicle || "não informado"}. Serviço solicitado: ${symptom}. Responda em português com ferramentas, segurança, desmontagem, montagem e conferência. Não invente torque ou especificação.` : `Você é um assistente de triagem automotiva. Veículo: ${vehicle || "não informado"}. Sintoma: ${symptom}. Responda em português com causas prováveis, verificações seguras e quando não dirigir.`;
  const models = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-2.0-flash"];
  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (!response.ok) { console.error("Diagnostic provider error", model, response.status, await response.text()); if (response.status === 429 || response.status === 403) break; continue; }
    const data = await response.json(); const answer = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n");
    if (answer) return Response.json({ answer });
  }
  return Response.json({ error: "Não foi possível concluir a consulta agora. Tente novamente em alguns instantes." }, { status: 502 });
}

import { createClient } from "@/lib/supabase/server";
import { findDtcReference, formatDtcReference } from "@/lib/dtc-catalog";

export async function POST(request: Request) {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const { symptom, vehicle, mode } = await request.json();
  if (typeof symptom !== "string" || symptom.trim().length < (mode === "dtc" ? 4 : 8)) return Response.json({ error: mode === "dtc" ? "Informe um código DTC válido." : "Descreva o sintoma com mais detalhes." }, { status: 400 });
  const dtcCode = symptom.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const localReference = mode === "dtc" ? findDtcReference(dtcCode) : null;
  if (!process.env.GEMINI_API_KEY) {
    if (localReference) return Response.json({ answer: formatDtcReference(localReference, vehicle), sources: [] });
    return Response.json({ error: "A consulta técnica online ainda não está configurada." }, { status: 503 });
  }
  const prompt = mode === "dtc" ? `Atue como consultor técnico automotivo. Veículo: ${vehicle || "não informado"}. Código DTC: ${dtcCode}. Identifique se o código é genérico ou específico. Responda em português, sem mencionar inteligência artificial ou provedor, nas seções: Código e descrição; Significado para o veículo; Causas prováveis; Testes recomendados; Atenção. Se variar por fabricante, declare a limitação e não invente a posição do componente.` : mode === "technical" ? `Você é um assistente de procedimentos de oficina automotiva no Brasil. Veículo: ${vehicle || "não informado"}. Serviço solicitado: ${symptom}. Responda em português com ferramentas, segurança, desmontagem, montagem e conferência. Não invente torque ou especificação.` : `Você é um assistente de triagem automotiva. Veículo: ${vehicle || "não informado"}. Sintoma: ${symptom}. Responda em português com causas prováveis, verificações seguras e quando não dirigir.`;
  const models = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-2.5-flash"];
  for (const model of models) {
    const body: Record<string, unknown> = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } };
    if (mode === "dtc") body.tools = [{ google_search: {} }];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify(body) });
    if (!response.ok) { console.error("Diagnostic provider error", model, response.status, await response.text()); if (response.status === 429 || response.status === 403) break; continue; }
    const data = await response.json();
    const candidate = data.candidates?.[0];
    const answer = candidate?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n");
    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((chunk: { web?: { uri?: string; title?: string } }) => chunk.web).filter((source: { uri?: string; title?: string } | undefined) => source?.uri).map((source: { uri: string; title?: string }) => ({ url: source.uri, title: source.title || "Referência técnica" })).filter((source: { url: string }, index: number, all: { url: string }[]) => all.findIndex((item) => item.url === source.url) === index).slice(0, 5);
    if (answer) return Response.json({ answer, sources });
  }
  if (localReference) return Response.json({ answer: formatDtcReference(localReference, vehicle), sources: [], fallback: true });
  return Response.json({ error: "Não foi possível concluir a consulta agora. Tente novamente em alguns instantes." }, { status: 502 });
}

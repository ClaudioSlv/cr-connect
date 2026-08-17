import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "O Gemini ainda não foi configurado. Adicione GEMINI_API_KEY nas variáveis da Vercel." }, { status: 503 });
  const { symptom, vehicle, mode } = await request.json();
  if (typeof symptom !== "string" || symptom.trim().length < 8) return Response.json({ error: "Descreva o sintoma com mais detalhes." }, { status: 400 });
  const prompt = mode === "technical" ? `Você é um assistente de procedimentos de oficina automotiva no Brasil. Veículo: ${vehicle || "não informado"}. Serviço solicitado: ${symptom}. Responda em português e organize exatamente em: 1) ferramentas necessárias, 2) preparação e segurança, 3) passos de desmontagem em ordem, 4) localização geral de parafusos, presilhas e conectores quando aplicável, 5) montagem e conferência final. Não invente torque, fluido ou especificação; quando o dado depender de versão, informe que deve ser confirmado no manual. Avise para desligar a bateria quando houver risco elétrico ou airbag.` : `Você é um assistente de triagem para oficina automotiva no Brasil. Veículo: ${vehicle || "não informado"}. Sintoma relatado: ${symptom}. Responda em português, de forma objetiva, com: 1) causas prováveis em ordem, 2) verificações seguras iniciais, 3) quando não dirigir/usar guincho. Não afirme certeza, não instrua procedimentos perigosos e recomende avaliação de profissional.`;
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  if (!response.ok) { console.error("Gemini API error", response.status, await response.text()); return Response.json({ error: "Não foi possível consultar o Gemini agora. Tente novamente em alguns instantes." }, { status: 502 }); }
  const data = await response.json(); const answer = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n") || "Sem resposta disponível.";
  return Response.json({ answer });
}

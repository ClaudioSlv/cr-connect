import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "O Gemini ainda não foi configurado. Adicione GEMINI_API_KEY nas variáveis da Vercel." }, { status: 503 });
  const { symptom, vehicle } = await request.json();
  if (typeof symptom !== "string" || symptom.trim().length < 8) return Response.json({ error: "Descreva o sintoma com mais detalhes." }, { status: 400 });
  const prompt = `Você é um assistente de triagem para oficina automotiva no Brasil. Veículo: ${vehicle || "não informado"}. Sintoma relatado: ${symptom}. Responda em português, de forma objetiva, com: 1) causas prováveis em ordem, 2) verificações seguras iniciais, 3) quando não dirigir/usar guincho. Não afirme certeza, não instrua procedimentos perigosos e recomende avaliação de profissional.`;
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
  if (!response.ok) return Response.json({ error: "Não foi possível consultar o Gemini agora." }, { status: 502 });
  const data = await response.json(); const answer = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n") || "Sem resposta disponível.";
  return Response.json({ answer });
}

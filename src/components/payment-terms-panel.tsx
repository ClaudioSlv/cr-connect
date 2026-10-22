"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { defaultPaymentTerms, parseSurcharge, paymentMethods, paymentMethodLabel, paymentMoney, paymentTotals, type PaymentData } from "@/lib/payment-terms";

export function PaymentTermsPanel({ kind, id, subtotal, version, editable = true, onChange, onSaved }: { kind: "order" | "budget"; id: string; subtotal?: number; version?: string; editable?: boolean; onChange?: (data: PaymentData | null) => void; onSaved?: () => void }) {
  const [data, setData] = useState<PaymentData | null>(null);
  const [method, setMethod] = useState("not_defined");
  const [terms, setTerms] = useState("");
  const [percent, setPercent] = useState("0");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  const dirty = data && (method !== data.payment_method || terms !== data.payment_terms || parseSurcharge(percent) !== Number(data.surcharge_percent));
  useEffect(() => { callback.current?.(dirty ? null : data); }, [dirty, data]);
  useEffect(() => {
    let cancelled = false;
    callback.current?.(null);
    void createClient().rpc("get_document_payment_terms", { p_kind: kind, p_id: id }).then(({ data: result, error }) => {
      if (cancelled) return;
      if (error) { setMessage("Não foi possível carregar as condições. Tente abrir novamente."); return; }
      const value = result as PaymentData;
      setData(value); setMethod(value.payment_method); setTerms(value.payment_terms); setPercent(String(value.surcharge_percent).replace(".", ",")); setAgreed(false); callback.current?.(value);
    });
    return () => { cancelled = true; };
  }, [kind, id, subtotal, version]);
  function changed() { setAgreed(false); callback.current?.(null); }
  async function save() {
    const parsed = parseSurcharge(percent);
    if (parsed === null) { setMessage("Informe um percentual de 0 a 100, com até duas casas decimais."); return; }
    setBusy(true); setMessage("");
    const { data: result, error } = await createClient().rpc("save_document_payment_terms", { p_kind: kind, p_id: id, p_method: method, p_terms: terms, p_percent: parsed, p_revision: data?.revision });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const value = result as PaymentData; setData(value); setAgreed(false); callback.current?.(value); onSaved?.(); setMessage("Condições salvas. Apresente o valor total ao cliente antes de registrar o aceite.");
  }
  async function accept() {
    if (!data || !agreed || dirty) return;
    setBusy(true); setMessage("");
    const { data: result, error } = await createClient().rpc("accept_document_payment_terms", { p_kind: kind, p_id: id, p_revision: data.revision, p_total: data.total });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const value = result as PaymentData; setData(value); setAgreed(false); callback.current?.(value); setMessage("Aceite registrado para estas condições e este valor.");
  }
  if (!editable && data && data.payment_method === "not_defined" && !data.payment_terms && Number(data.surcharge_percent) === 0) return null;
  const totals = paymentTotals(data?.subtotal || 0, parseSurcharge(percent) ?? 0);
  return <section className="mt-4 rounded-xl border border-[#6b510d] bg-black/20 p-4">
    <h3 className="font-bold text-[#FFC107]">Pagamento e aceite do cliente</h3>
    {!data ? <p role="status" className="mt-3 text-sm text-zinc-300">{message || "Carregando condições…"}</p> : <>
      {editable ? <div className="mt-3 grid gap-3">
        <label className="text-sm text-zinc-300">Forma de pagamento<select disabled={busy} className="field mt-1" value={method} onChange={e => { setMethod(e.target.value); changed(); }}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm text-zinc-300">Acréscimo (%)<input disabled={busy} className="field mt-1" inputMode="decimal" value={percent} onChange={e => { setPercent(e.target.value); changed(); }} /></label>
        <label className="text-sm text-zinc-300">Condições e prazo combinados<textarea disabled={busy} maxLength={2000} className="field mt-1 min-h-24" value={terms} placeholder="Informe a entrada, as parcelas e as datas combinadas." onChange={e => { setTerms(e.target.value); changed(); }} /></label>
        <button disabled={busy} type="button" onClick={() => { setTerms(defaultPaymentTerms); changed(); }} className="text-left text-sm text-[#FFC107]">Usar condição: pagamento na entrega e parcelamento só no cartão</button>
        <button type="button" disabled={busy || !dirty} onClick={() => void save()} className="rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{busy ? "Aguarde…" : "Salvar condições de pagamento"}</button>
      </div> : <div className="mt-3 text-sm text-zinc-200"><p>{paymentMethodLabel(data.payment_method)}</p><p className="mt-2 whitespace-pre-wrap">{data.payment_terms || "Condições a combinar com a oficina."}</p></div>}
      <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>Serviços e peças</dt><dd>{paymentMoney(totals.subtotal)}</dd></div><div className="flex justify-between gap-3"><dt>Acréscimo ({parseSurcharge(percent) ?? 0}%)</dt><dd>{paymentMoney(totals.surcharge)}</dd></div><div className="flex justify-between gap-3 font-bold text-[#FFC107]"><dt>Total combinado</dt><dd>{paymentMoney(totals.total)}</dd></div></dl>
      {dirty ? <p className="mt-3 text-sm text-amber-300">Salve as condições antes de compartilhar ou registrar o aceite.</p> : data.acceptance ? <p className="mt-3 text-sm text-emerald-300">{data.acceptance.source === "client_portal" ? "Aceito pelo cliente no portal" : "Aceite informado pela oficina"} em {new Date(data.acceptance.at).toLocaleString("pt-BR")} · {paymentMoney(data.acceptance.total)}</p> : <div className="mt-4 border-t border-zinc-700 pt-4"><p className="text-sm text-amber-300">Aceite pendente. Combine o pagamento antes de iniciar o serviço.</p><label className="mt-3 flex items-start gap-3 text-sm text-zinc-200"><input type="checkbox" disabled={busy || method === "not_defined" || !terms.trim() || totals.total <= 0} checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1"/>{editable ? "Confirmo que o cliente aceitou estas condições e este valor. Estou registrando o combinado pela oficina." : "Li e aceito a forma de pagamento, o acréscimo e o valor total acima."}</label><button type="button" disabled={!agreed || busy} onClick={() => void accept()} className="mt-3 rounded-lg border border-[#FFC107] px-4 py-3 font-bold text-[#FFC107] disabled:opacity-60">{busy ? "Registrando…" : "Registrar aceite"}</button></div>}
      {message && <p role="status" className="mt-3 text-sm text-[#FFC107]">{message}</p>}
    </>}
  </section>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { defaultPaymentTerms, parseSurcharge, paymentMethods, paymentMethodLabel, paymentMoney, paymentTotals, type PaymentData } from "@/lib/payment-terms";

export function PaymentTermsPanel({ kind, id, subtotal, version, editable = true, onChange, onSaved }: { kind: "order" | "budget"; id: string; subtotal?: number; version?: string; editable?: boolean; onChange?: (data: PaymentData | null) => void; onSaved?: () => void }) {
  const [data, setData] = useState<PaymentData | null>(null);
  const [method, setMethod] = useState("not_defined");
  const [terms, setTerms] = useState("");
  const [percent, setPercent] = useState("");
  const [deferred, setDeferred] = useState(false);
  const [reason, setReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  const discountRate = data && method === "pix" && !deferred && !(parseSurcharge(percent) || 0) ? Number(editable ? data.available_pix_discount_percent ?? data.pix_discount_percent ?? 0 : data.pix_discount_percent || 0) : 0;
  const dirty = data && (method !== data.payment_method || terms !== data.payment_terms || (percent.trim() ? parseSurcharge(percent) : 0) !== Number(data.surcharge_percent) || reason !== data.surcharge_reason || deferred !== Boolean(data.deferred_without_deposit) || discountRate !== Number(data.pix_discount_percent || 0));
  useEffect(() => { callback.current?.(dirty ? null : data); }, [dirty, data]);
  useEffect(() => {
    let cancelled = false;
    callback.current?.(null);
    void createClient().rpc("get_document_payment_terms", { p_kind: kind, p_id: id }).then(({ data: result, error }) => {
      if (cancelled) return;
      if (error) { setMessage("Não foi possível carregar as condições. Tente abrir novamente."); return; }
      const value = result as PaymentData;
      setData(value); setMethod(value.payment_method); setTerms(value.payment_terms); setPercent(Number(value.surcharge_percent) === 0 ? "" : String(value.surcharge_percent).replace(".", ",")); setReason(value.surcharge_reason || ""); setDeferred(Boolean(value.deferred_without_deposit)); setAgreed(false); callback.current?.(value);
    });
    return () => { cancelled = true; };
  }, [kind, id, subtotal, version]);
  function changed() { setAgreed(false); callback.current?.(null); }
  async function save() {
    const parsed = percent.trim() ? parseSurcharge(percent) : 0;
    if (parsed === null) { setMessage("Informe um percentual de 0 a 100, com até duas casas decimais."); return; }
    if (parsed > 0 && !reason.trim()) { setMessage("Informe o motivo do acréscimo escolhido."); return; }
    setBusy(true); setMessage("");
    const { data: result, error } = await createClient().rpc("save_document_payment_terms", { p_kind: kind, p_id: id, p_method: method, p_terms: terms, p_percent: parsed, p_revision: data?.revision, p_reason: reason.trim(), p_deferred: deferred });
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
  const totals = paymentTotals(data?.subtotal || 0, parseSurcharge(percent) ?? 0, discountRate);
  return <section className="mt-4 rounded-xl border border-[#6b510d] bg-black/20 p-4">
    <h3 className="font-bold text-[#FFC107]">Pagamento e aceite do cliente</h3>
    {!data ? <p role="status" className="mt-3 text-sm text-zinc-300">{message || "Carregando condições…"}</p> : <>
      {editable ? <div className="mt-3 grid gap-3">
        <label className="text-sm text-zinc-300">Forma de pagamento<select disabled={busy} className="field mt-1" value={method} onChange={e => { setMethod(e.target.value); if (e.target.value === "pix" && !terms.trim()) setTerms("Pagamento integral via Pix na entrega do veículo."); changed(); }}>{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="flex items-start gap-3 rounded-lg border border-zinc-700 p-3 text-sm text-zinc-200"><input type="checkbox" disabled={busy} className="mt-1" checked={deferred} onChange={e => { setDeferred(e.target.checked); if (!e.target.checked) { setPercent(""); setReason(""); } changed(); }} />Retirada sem entrada, com pagamento depois da entrega</label>
        {deferred ? <><p className="text-sm text-amber-300">Informe o acréscimo e o motivo combinados com o cliente. Esta condição não recebe desconto Pix.</p><label className="text-sm text-zinc-300">Acréscimo (%)<input disabled={busy} className="field mt-1" inputMode="decimal" value={percent} onChange={e => { setPercent(e.target.value); changed(); }} /></label><label className="text-sm text-zinc-300">Motivo do acréscimo<input disabled={busy} maxLength={500} className="field mt-1" value={reason} onChange={e => { setReason(e.target.value); changed(); }} /></label></> : method === "pix" ? <p className="text-sm text-emerald-300">Desconto Pix: {discountRate}%, para pagamento integral na entrega. O valor com desconto será salvo nestas condições.</p> : <p className="text-sm text-zinc-400">Para pagamento integral pelo QR Code, selecione Pix para aplicar o desconto configurado na oficina.</p>}
        <label className="text-sm text-zinc-300">Condições e prazo combinados<textarea disabled={busy} maxLength={2000} className="field mt-1 min-h-24" value={terms} placeholder="Informe a entrada, as parcelas e as datas combinadas." onChange={e => { setTerms(e.target.value); changed(); }} /></label>
        <button disabled={busy} type="button" onClick={() => { setTerms(defaultPaymentTerms); setDeferred(false); setPercent(""); setReason(""); changed(); }} className="text-left text-sm text-[#FFC107]">Usar condição: pagamento na entrega e parcelamento só no cartão</button>
        <button type="button" disabled={busy || !dirty} onClick={() => void save()} className="rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{busy ? "Aguarde…" : "Salvar condições de pagamento"}</button>
      </div> : <div className="mt-3 text-sm text-zinc-200"><p>{paymentMethodLabel(data.payment_method)}</p>{data.deferred_without_deposit && <p className="mt-2">Retirada sem entrada, com pagamento depois da entrega.</p>}{data.surcharge_reason && <p className="mt-2">Motivo do acréscimo: {data.surcharge_reason}</p>}<p className="mt-2 whitespace-pre-wrap">{data.payment_terms || "Condições a combinar com a oficina."}</p></div>}
      <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>Serviços e peças</dt><dd>{paymentMoney(totals.subtotal)}</dd></div><div className="flex justify-between gap-3"><dt>Acréscimo ({parseSurcharge(percent) ?? 0}%)</dt><dd>{paymentMoney(totals.surcharge)}</dd></div>{totals.discount > 0 && <div className="flex justify-between gap-3 text-emerald-300"><dt>Desconto Pix ({discountRate}%)</dt><dd>− {paymentMoney(totals.discount)}</dd></div>}<div className="flex justify-between gap-3 font-bold text-[#FFC107]"><dt>Total combinado</dt><dd>{paymentMoney(totals.total)}</dd></div></dl>
      {dirty ? <p className="mt-3 text-sm text-amber-300">Salve as condições antes de compartilhar ou registrar o aceite.</p> : data.acceptance ? <p className="mt-3 text-sm text-emerald-300">{data.acceptance.source === "client_portal" ? "Aceito pelo cliente no portal" : "Aceite informado pela oficina"} em {new Date(data.acceptance.at).toLocaleString("pt-BR")} · {paymentMoney(data.acceptance.total)}</p> : <div className="mt-4 border-t border-zinc-700 pt-4"><p className="text-sm text-amber-300">Aceite pendente. Combine o pagamento antes de iniciar o serviço.</p><label className="mt-3 flex items-start gap-3 text-sm text-zinc-200"><input type="checkbox" disabled={busy || method === "not_defined" || !terms.trim() || totals.total <= 0} checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1"/>{editable ? "Confirmo que o cliente aceitou estas condições e este valor. Estou registrando o combinado pela oficina." : "Li e aceito as condições de pagamento, os descontos ou acréscimos e o valor total acima."}</label><button type="button" disabled={!agreed || busy} onClick={() => void accept()} className="mt-3 rounded-lg border border-[#FFC107] px-4 py-3 font-bold text-[#FFC107] disabled:opacity-60">{busy ? "Registrando…" : "Registrar aceite"}</button></div>}
      {message && <p role="status" className="mt-3 text-sm text-[#FFC107]">{message}</p>}
    </>}
  </section>;
}

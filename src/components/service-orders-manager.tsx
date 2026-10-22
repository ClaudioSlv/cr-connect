"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { orderDraftKey, parseOrderDraft } from "@/lib/service-order-draft";
import { OrderItemsPanel } from "@/components/order-items-panel";
import { OrderMileagePhotos } from "@/components/order-mileage-photos";
import { uploadMileagePhoto, mileagePhotoLabels, type MileageDrafts, type MileagePhotoKind } from "@/lib/mileage-photos";
import { PaymentTermsPanel } from "@/components/payment-terms-panel";
import { paymentTotals, type PaymentData } from "@/lib/payment-terms";
import { PrintDocument } from "@/components/print-document";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { AttachmentsManager } from "@/components/attachments-manager";

type Client = { id: string; full_name: string; phone: string | null; whatsapp: string | null };
type Vehicle = { id: string; client_id: string; brand: string; model: string; plate: string | null };
type Order = { id: string; number: number; client_id: string; vehicle_id: string; status: string; customer_complaint: string; diagnosis: string | null; notes: string | null; appointment_requested_at: string | null; appointment_confirmed_at: string | null; clients: Client | null; vehicles: Vehicle | null };
type OrderItem = { description: string; quantity: number; unit_price: number; discount: number };
type ServiceRequest = { id: string; client_id: string; vehicle_id: string; owner_id: string; complaint: string; status: "requested" | "converted" | "declined"; created_at: string; clients: Client | null; vehicles: Vehicle | null };

const states = [["open", "Aberta"], ["diagnosing", "Em diagnóstico"], ["awaiting_approval", "Aguardando aprovação"], ["awaiting_appointment", "Aguardando agendamento"], ["appointment_confirmed", "Agendamento confirmado"], ["awaiting_part", "Aguardando peça"], ["repairing", "Em reparo"], ["finished", "Finalizada"], ["delivered", "Entregue"], ["cancelled", "Cancelada"]];

export function ServiceOrdersManager({ workshopId, userId }: { workshopId: string; userId: string }) {
  const db = createClient();
  const draftKey = orderDraftKey(workshopId, userId);
  const userTouched = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [client, setClient] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [status, setStatus] = useState("open");
  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [mileageDrafts, setMileageDrafts] = useState<MileageDrafts>({});
  const [photoRefresh, setPhotoRefresh] = useState(0);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const dirty = Object.keys(mileageDrafts).length > 0 || (selected
    ? client !== selected.client_id || vehicle !== selected.vehicle_id || status !== selected.status || complaint !== selected.customer_complaint || diagnosis !== (selected.diagnosis || "") || note !== (selected.notes || "")
    : Boolean(client || vehicle || complaint || diagnosis || note || status !== "open"));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const orderSubtotal = orderItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0), 0);

  const orderTotal = paymentTotals(orderSubtotal, payment?.surcharge_percent || 0).total;

  async function load() {
    const [clientResult, vehicleResult, orderResult, requestResult] = await Promise.all([
      db.from("clients").select("id,full_name,phone,whatsapp").eq("workshop_id", workshopId),
      db.from("vehicles").select("id,client_id,brand,model,plate").eq("workshop_id", workshopId),
      db.from("service_orders").select("id,number,client_id,vehicle_id,status,customer_complaint,diagnosis,notes,appointment_requested_at,appointment_confirmed_at,clients(id,full_name,phone,whatsapp),vehicles(id,client_id,brand,model,plate)").eq("workshop_id", workshopId).order("opened_at", { ascending: false }),
      db.from("service_requests").select("id,client_id,vehicle_id,owner_id,complaint,status,created_at,clients(id,full_name),vehicles(id,client_id,brand,model,plate)").eq("workshop_id", workshopId).eq("status", "requested").order("created_at", { ascending: false }),
    ]);
    setClients((clientResult.data || []) as Client[]);
    setVehicles((vehicleResult.data || []) as Vehicle[]);
    setOrders((orderResult.data || []) as unknown as Order[]);
    setRequests((requestResult.data || []) as unknown as ServiceRequest[]);
    return (orderResult.data || []) as unknown as Order[];
  }

  useEffect(() => {
    let cancelled = false;
    // Synchronize remote rows and the persisted camera draft when this scope opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().then(async current => {
      if (cancelled || userTouched.current) return;
      let raw: string | null = null;
      try { raw = window.localStorage.getItem(draftKey); } catch { return; }
      const draft = parseOrderDraft(raw);
      if (!draft) return;
      const restored = draft.selectedId ? current.find(order => order.id === draft.selectedId) : null;
      if (draft.selectedId && !restored) {
        setMessage("O rascunho pertence a uma O.S. que não está disponível. Abra a ordem desejada para continuar."); return;
      }
      setSelected(restored || null); setClient(draft.client); setVehicle(draft.vehicle); setStatus(draft.status); setComplaint(draft.complaint); setDiagnosis(draft.diagnosis); setNote(draft.note);
      setMessage("Preenchimento recuperado após a câmera. Confira os dados. Fotos ainda não salvas devem ser selecionadas novamente.");
      if (restored) {
        const { data } = await db.from("service_order_items").select("description,quantity,unit_price,discount").eq("workshop_id", workshopId).eq("service_order_id", restored.id);
        if (!cancelled) setOrderItems((data || []) as OrderItem[]);
      }
    });
    return () => { cancelled = true; };
    // The initial recovery runs once for the signed-in workshop/user scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  function preserveCameraDraft(selectedId: string | null = selected?.id || null) {
    userTouched.current = true;
    try { window.localStorage.setItem(draftKey, JSON.stringify({ selectedId, client, vehicle, status, complaint, diagnosis, note, savedAt: Date.now() })); }
    catch { setMessage("Não foi possível guardar o rascunho neste navegador. Salve a O.S. antes de sair da página."); }
  }
  function clearCameraDraft() { try { window.localStorage.removeItem(draftKey); } catch {} }

  const allowed = vehicles.filter((item) => item.client_id === client);

  function sendWhatsApp() {
    if (!selected || !payment) { setMessage("Confira e salve as condições de pagamento antes de compartilhar."); return; }
    const contact = selected.clients?.whatsapp || selected.clients?.phone;
    const number = (contact || "").replace(/\D/g, "");
    if (!number) { setMessage("Cadastre o WhatsApp ou telefone do cliente antes de enviar."); return; }
    const international = number.startsWith("55") ? number : `55${number}`;
    const text = `Olá, ${selected.clients?.full_name || "cliente"}! A O.S. #${selected.number} foi atualizada. Valor atual: R$ ${orderTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Condições: ${payment.payment_terms || "A combinar"}. Vou enviar o PDF em seguida.`;
    window.open(`https://wa.me/${international}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("Aguarde, salvando a O.S…");
    const payload = { workshop_id: workshopId, client_id: client, vehicle_id: vehicle, status, customer_complaint: complaint, diagnosis: diagnosis || null, notes: note || null };
    const selection = "id,number,client_id,vehicle_id,status,customer_complaint,diagnosis,notes,appointment_requested_at,appointment_confirmed_at,clients(id,full_name,phone,whatsapp),vehicles(id,client_id,brand,model,plate)";
    const result = selected
      ? await db.from("service_orders").update(payload).eq("id", selected.id).select(selection).single()
      : await db.from("service_orders").insert(payload).select(selection).single();
    if (result.error) { setSaving(false); setMessage(result.error.message); return; }
    const savedOrder = result.data as unknown as Order;
    setSelected(savedOrder);
    preserveCameraDraft(savedOrder.id);
    const failed: MileageDrafts = {};
    const photoErrors: string[] = [];
    for (const [kind, file] of Object.entries(mileageDrafts) as [MileagePhotoKind, File][]) {
      try { await uploadMileagePhoto(workshopId, savedOrder.id, kind, file); }
      catch (error) { failed[kind] = file; photoErrors.push(`${mileagePhotoLabels[kind]}: ${error instanceof Error ? error.message : "envio falhou"}`); }
    }
    setMileageDrafts(failed); setPhotoRefresh(value => value + 1); setSaving(false);
    if (photoErrors.length) { setMessage(`O.S. salva, mas há foto pendente. Toque em Salvar O.S. para tentar novamente. ${photoErrors.join("; ")}`); await load(); return; }
    clearCameraDraft();
    setMessage(`O.S. #${savedOrder.number} salva. Use “Gerar PDF” para baixar ou compartilhar com o cliente.`);
    await load();
  }

  async function edit(order: Order) {
    if (dirty && !window.confirm("Descartar as alterações não salvas para abrir outra O.S.?")) return;
    clearCameraDraft();
    setMileageDrafts({}); setPayment(null); setSelected(order); setOrderItems([]); setClient(order.client_id); setVehicle(order.vehicle_id); setStatus(order.status); setComplaint(order.customer_complaint); setDiagnosis(order.diagnosis || ""); setNote(order.notes || ""); setMessage(`O.S. #${order.number} aberta para edição.`);
    const { data } = await db.from("service_order_items").select("description,quantity,unit_price,discount").eq("workshop_id", workshopId).eq("service_order_id", order.id);
    setOrderItems((data || []) as OrderItem[]);
    window.setTimeout(() => { const section = formRef.current?.querySelector("details"); if (section) section.open = true; formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);
  }

  async function remove(order: Order) {
    if (!window.confirm(`Excluir a O.S. #${order.number} de ${order.clients?.full_name || "cliente"}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await db.from("service_orders").delete().eq("id", order.id).eq("workshop_id", workshopId);
    if (error) { setMessage(error.message); return; }
    if (selected?.id === order.id) { clearCameraDraft(); setMileageDrafts({}); setSelected(null); setOrderItems([]); setClient(""); setVehicle(""); setStatus("open"); setComplaint(""); setDiagnosis(""); setNote(""); }
    setMessage(`O.S. #${order.number} excluída.`);
    await load();
  }

  async function acceptRequest(request: ServiceRequest) {
    if (saving) return;
    setSaving(true); setMessage("Aceitando solicitação e criando a O.S.…");
    const { data, error } = await db.rpc("accept_client_service_request", { p_request_id: request.id });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setMessage("Solicitação aceita. A O.S. foi criada e o cliente foi avisado.");
    await load();
    const created = (orders || []).find((order) => order.id === data);
    if (created) await edit(created);
  }

  async function declineRequest(request: ServiceRequest) {
    if (saving || !window.confirm("Recusar esta solicitação?")) return;
    setSaving(true); setMessage("Recusando solicitação…");
    const { error } = await db.rpc("decline_client_service_request", { p_request_id: request.id });
    setSaving(false);
    setMessage(error?.message || "Solicitação recusada. O cliente foi avisado.");
    if (!error) await load();
  }

  async function confirmAppointment(order: Order) {
    if (saving || !order.appointment_requested_at) return;
    setSaving(true); setMessage("Confirmando o agendamento…");
    const { error } = await db.rpc("confirm_service_appointment", { p_order_id: order.id });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setMessage(`Agendamento da O.S. #${order.number} confirmado. O cliente foi avisado.`);
    await load();
  }

  return <div className="grid gap-7 xl:grid-cols-[420px_1fr]">
    {orders.some((order) => order.status === "awaiting_appointment" && order.appointment_requested_at) && <section className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 p-5 xl:col-span-2"><h2 className="text-xl font-semibold text-emerald-300">Agendamentos aguardando confirmação</h2><p className="mt-1 text-sm text-zinc-300">Confirme a data solicitada pelo cliente para que ele receba o aviso.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{orders.filter((order) => order.status === "awaiting_appointment" && order.appointment_requested_at).map((order) => <article key={order.id} className="rounded-lg border border-emerald-500/30 bg-black/30 p-4"><b>O.S. #{order.number} · {order.clients?.full_name}</b><p className="mt-2 text-sm text-zinc-200">{new Date(order.appointment_requested_at!).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void confirmAppointment(order)} className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-black disabled:opacity-60">Confirmar agendamento</button><button type="button" onClick={() => void edit(order)} className="rounded-lg border border-zinc-500 px-4 py-2 font-bold text-zinc-100">Abrir O.S.</button></div></article>)}</div></section>}
    <section className="min-w-0 rounded-xl border border-zinc-800 bg-[#1A1A1A] p-4 sm:p-5">
      <form id="service-order-form" ref={formRef} onSubmit={save} onChangeCapture={() => { userTouched.current = true; }} onInvalidCapture={(event) => { const field = event.target as HTMLElement; const section = field.closest("details"); if (section) section.open = true; }}>
      <div className="mb-4 rounded-xl border border-zinc-700 bg-black/30 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FFC107]">{selected ? `O.S. #${selected.number}` : "Novo atendimento"}</p>
        <h2 className="mt-2 text-xl font-bold break-words">{clients.find(item => item.id === client)?.full_name || "Selecione o cliente"}</h2>
        <p className="mt-1 text-sm text-zinc-300">{vehicles.filter(item => item.id === vehicle).map(item => `${item.brand} ${item.model} · ${item.plate || "sem placa"}`).join("") || "Selecione o veículo"}</p>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span className="rounded-md bg-[#FFC107]/10 px-2 py-1 font-bold text-[#FFC107]">{states.find(item => item[0] === status)?.[1]}</span><b className="py-1">R$ {orderTotal.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2})}</b></div>
      </div>
      <details name="order-editor" open className="rounded-xl border border-zinc-700 bg-black/20 p-4">
        <summary className="cursor-pointer font-bold text-zinc-100">Dados do atendimento</summary>
        <div className="mt-4 grid gap-4">
          <label className="text-sm text-zinc-300">Cliente *<select required className="field mt-1" value={client} onChange={(event) => { setClient(event.target.value); setVehicle(""); setMileageDrafts({}); }}><option value="">Selecione o cliente</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select></label>
          <label className="text-sm text-zinc-300">Veículo *<select required className="field mt-1" disabled={!client} value={vehicle} onChange={(event) => { setVehicle(event.target.value); setMileageDrafts({}); }}><option value="">Selecione o veículo</option>{allowed.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model} {item.plate ? `(${item.plate})` : ""}</option>)}</select></label>
          <label className="text-sm text-zinc-300">Situação do atendimento<select className="field mt-1" value={status} onChange={(event) => setStatus(event.target.value)}>{states.map((item) => <option key={item[0]} value={item[0]}>{item[1]}</option>)}</select></label>
          <label className="text-sm text-zinc-300">Defeito relatado pelo cliente *<textarea required className="field mt-1 min-h-28" value={complaint} onChange={(event) => setComplaint(event.target.value)} /></label>
          <label className="text-sm text-zinc-300">Diagnóstico da oficina<textarea className="field mt-1 min-h-24" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /></label>
          <label className="text-sm text-zinc-300">Observações<textarea className="field mt-1 min-h-24" value={note} onChange={(event) => setNote(event.target.value)} /></label>
        </div>
      </details>
      <OrderMileagePhotos key={selected?.id || "new"} workshopId={workshopId} orderId={selected?.id} drafts={mileageDrafts} onBeforeCapture={()=>preserveCameraDraft()} disabled={saving} refresh={photoRefresh} onDraft={(kind, file) => setMileageDrafts(current => ({ ...current, [kind]: file }))} onSavedPhoto={kind => setMileageDrafts(current => { const next = { ...current }; delete next[kind]; return next; })} />
      {message && <p className="mt-3 text-sm text-[#FFC107]">{message}</p>}
      {selected?.status === "awaiting_appointment" && selected.appointment_requested_at && <div className="mt-4 rounded-lg border border-emerald-500/60 bg-emerald-500/10 p-4"><p className="text-sm text-zinc-200">Data solicitada pelo cliente: <b>{new Date(selected.appointment_requested_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</b></p><button type="button" disabled={saving} onClick={() => void confirmAppointment(selected)} className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 font-bold text-black disabled:opacity-60">Confirmar agendamento</button></div>}
      </form>
      {selected && <PaymentTermsPanel key={selected.id} kind="order" id={selected.id} subtotal={orderSubtotal} version={JSON.stringify(orderItems)} onChange={setPayment} />}
      {selected && <div className="my-4 rounded-xl border border-zinc-700 bg-black/20 p-4"><h3 className="text-sm font-bold">Acompanhamento da O.S.</h3><OrderStatusTimeline status={selected.status} />{dirty && status !== selected.status && <p className="mt-2 text-xs text-[#FFC107]">A nova situação será aplicada ao salvar.</p>}</div>}
      {selected ? <div key={selected.id} className="mt-4 space-y-3">
        <details name="order-editor" className="rounded-xl border border-zinc-700 bg-black/20 p-4"><summary className="cursor-pointer font-bold">Serviços e peças · R$ {orderTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</summary><p className="mt-3 text-xs text-zinc-400">Os itens são salvos ao adicionar ou remover.</p><OrderItemsPanel workshopId={workshopId} orderId={selected.id} status={status} surchargePercent={payment?.surcharge_percent || 0} onItemsChange={setOrderItems} /></details>
        <details name="order-editor" className="rounded-xl border border-zinc-700 bg-black/20 p-4"><summary className="cursor-pointer font-bold">Fotos e documentos</summary><AttachmentsManager workshopId={workshopId} orderId={selected.id} /></details>
        <details name="order-editor" className="rounded-xl border border-zinc-700 bg-black/20 p-4"><summary className="cursor-pointer font-bold">Compartilhar O.S.</summary><p className="mt-3 text-sm text-zinc-400">{dirty ? "Salve as alterações antes de gerar o documento." : "Baixe o PDF e anexe na conversa do WhatsApp."}</p><div className="mt-3 flex flex-wrap gap-2">{!dirty && <><PrintDocument type="Ordem de Serviço" number={`#${selected.number}`} client={selected.clients?.full_name || "Cliente"} vehicle={`${selected.vehicles?.brand || ""} ${selected.vehicles?.model || ""} ${selected.vehicles?.plate || ""}`} status={states.find((item) => item[0] === status)?.[1] || status} note={note || complaint} items={orderItems} orderId={selected.id} payment={payment} disabled={!payment} /><button type="button" onClick={sendWhatsApp} className="rounded-lg border border-emerald-500/70 px-4 py-3 text-sm font-bold text-emerald-300">Enviar no WhatsApp</button></>}</div></details>
      </div> : <p className="mt-4 text-sm text-zinc-400">Salve a O.S. para adicionar serviços, peças e fotos.</p>}
      <div className="mt-5 rounded-xl border border-zinc-600 bg-[#171717] p-3 shadow-xl">
        <p role="status" className="mb-2 text-xs text-zinc-300">{dirty ? "Alterações ainda não salvas" : selected ? "Dados do atendimento salvos" : "Preencha os dados do atendimento"}</p>
        <div className="flex flex-wrap gap-2"><button type="submit" form="service-order-form" disabled={saving} className="min-h-12 flex-1 rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{saving ? "Salvando…" : "Salvar O.S."}</button><a href="/app" onClick={(event) => { if (dirty && !window.confirm("Sair sem salvar as alterações da O.S.?")) event.preventDefault(); else clearCameraDraft(); }} className="rounded-lg border border-zinc-600 px-4 py-3 text-sm font-bold">Voltar ao menu</a></div>
      </div>
    </section>
    <section><div className="rounded-xl border border-[#FFC107]/60 bg-[#211805] p-5"><h2 className="text-xl font-semibold text-[#FFC107]">Solicitações dos clientes</h2><p className="mt-1 text-sm text-zinc-300">Aceite para criar a O.S. e iniciar o orçamento. O cliente recebe a confirmação no aplicativo.</p><div className="mt-4 space-y-3">{requests.length === 0 && <p className="text-sm text-zinc-400">Nenhuma solicitação nova.</p>}{requests.map((request) => <article key={request.id} className="rounded-lg border border-[#6b510d] bg-black/30 p-4"><b>{request.clients?.full_name || "Cliente"}</b><small className="mt-1 block text-zinc-400">{request.vehicles?.brand} {request.vehicles?.model} · {request.vehicles?.plate || "sem placa"}</small><p className="mt-3 text-sm text-zinc-200">{request.complaint}</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => void acceptRequest(request)} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:opacity-60">Aceitar e criar O.S.</button><button type="button" disabled={saving} onClick={() => void declineRequest(request)} className="rounded-lg border border-red-500/70 px-4 py-2 font-bold text-red-300 disabled:opacity-60">Recusar</button></div></article>)}</div></div><h2 className="mt-7 text-xl font-semibold">Ordens de serviço</h2><p className="mt-1 text-sm text-zinc-400">Toque em Editar O.S. para abrir o atendimento e fazer alterações.</p><div className="mt-4 space-y-3">{orders.map((order) => <article key={order.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-4"><div className="flex flex-wrap justify-between gap-3"><span><b>O.S. #{order.number}</b> · {order.clients?.full_name}<br /><small className="text-zinc-500">{order.vehicles?.brand} {order.vehicles?.model} · {order.vehicles?.plate || "sem placa"}</small></span><b className={order.status === "cancelled" ? "text-red-400" : order.status === "repairing" || order.status === "finished" || order.status === "delivered" ? "text-emerald-400" : "text-[#FFC107]"}>{states.find((item) => item[0] === order.status)?.[1]}</b></div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => void edit(order)} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Editar O.S.</button><button type="button" onClick={() => void remove(order)} className="rounded-lg border border-red-500/70 px-4 py-2 font-bold text-red-300">Excluir O.S.</button></div></article>)}</div></section>
  </div>;
}

"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Attachment = { id: string; file_name: string; mime_type: string; size_bytes: number; storage_path: string; url?: string };
const bucket = "workshop-attachments";
const maxFileSize = 25 * 1024 * 1024;

function readableSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileKind(item: Attachment) {
  if (item.mime_type.startsWith("image/")) return "imagem";
  if (item.mime_type.startsWith("video/")) return "vídeo";
  if (item.mime_type === "application/pdf") return "PDF";
  return "documento";
}

export function AttachmentsManager({ workshopId, orderId }: { workshopId: string; orderId: string }) {
  const db = createClient();
  const [items, setItems] = useState<Attachment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data } = await db.from("attachments").select("id,file_name,mime_type,size_bytes,storage_path").eq("workshop_id", workshopId).eq("service_order_id", orderId).order("created_at", { ascending: false });
    const withUrls = await Promise.all((data || []).map(async (item) => {
      const { data: signed } = await db.storage.from(bucket).createSignedUrl(item.storage_path, 3600);
      return { ...item, url: signed?.signedUrl };
    }));
    setItems(withUrls);
  }

  useEffect(() => { void load(); }, [orderId]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const oversized = files.find((file) => file.size > maxFileSize);
    if (oversized) {
      setMessage(`“${oversized.name}” ultrapassa o limite de 25 MB.`);
      event.target.value = "";
      return;
    }

    setLoading(true);
    setMessage(`Enviando ${files.length} arquivo${files.length > 1 ? "s" : ""}…`);
    let completed = 0;
    let failure = "";

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${workshopId}/orders/${orderId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await db.storage.from(bucket).upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) { failure = uploadError.message; continue; }

      const { error } = await db.from("attachments").insert({
        workshop_id: workshopId,
        service_order_id: orderId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      });
      if (error) {
        await db.storage.from(bucket).remove([path]);
        failure = error.message;
      } else {
        completed += 1;
      }
    }

    await load();
    setMessage(failure ? `${completed} arquivo(s) enviado(s). Erro: ${failure}` : `${completed} arquivo(s) enviado(s) com sucesso.`);
    setLoading(false);
    event.target.value = "";
  }

  async function remove(item: Attachment) {
    if (!confirm(`Remover ${item.file_name}?`)) return;
    await db.storage.from(bucket).remove([item.storage_path]);
    await db.from("attachments").delete().eq("id", item.id);
    await load();
  }

  return (
    <section className="mt-5 rounded-xl border border-zinc-800 bg-black/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-[#FFC107]">FOTOS, VÍDEOS E DOCUMENTOS</p>
          <p className="mt-1 text-xs text-zinc-500">Registre defeitos, peças e o serviço realizado. Até 25 MB por arquivo.</p>
        </div>
        <label className="cursor-pointer rounded-lg border border-[#FFC107] px-3 py-2 text-sm font-bold text-[#FFC107] hover:bg-[#261e0b]">
          {loading ? "Enviando…" : "Adicionar arquivos"}
          <input disabled={loading} multiple type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={upload} />
        </label>
      </div>
      {message && <p className="mt-3 text-sm text-zinc-300">{message}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            {item.mime_type.startsWith("image/") && item.url ? <img src={item.url} alt={item.file_name} className="h-36 w-full object-cover" /> : null}
            {item.mime_type.startsWith("video/") && item.url ? <video controls preload="metadata" className="h-36 w-full bg-black object-cover"><source src={item.url} type={item.mime_type} /></video> : null}
            {!item.mime_type.startsWith("image/") && !item.mime_type.startsWith("video/") ? <div className="grid h-24 place-items-center text-sm font-bold text-zinc-300">{fileKind(item).toUpperCase()}</div> : null}
            <div className="flex items-center justify-between gap-2 p-3">
              <a className="min-w-0 truncate text-sm text-[#FFC107] underline" href={item.url} target="_blank" rel="noreferrer">{item.file_name}</a>
              <div className="shrink-0 text-right"><p className="text-xs text-zinc-500">{readableSize(item.size_bytes)}</p><button onClick={() => void remove(item)} className="mt-1 text-xs text-red-300">Remover</button></div>
            </div>
          </article>
        ))}
        {items.length === 0 && <p className="text-sm text-zinc-500">Nenhum anexo nesta O.S.</p>}
      </div>
    </section>
  );
}

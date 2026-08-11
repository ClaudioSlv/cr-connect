"use client";

import { useState } from "react";

type Line = { description: string; quantity: number; unit_price: number; discount?: number };
type Props = { type: "Orçamento" | "Ordem de Serviço"; number: string; client: string; vehicle: string; status: string; items: Line[]; note?: string | null };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PrintDocument({ type, number, client, vehicle, status, items, note }: Props) {
  const [message, setMessage] = useState("");

  function print() {
    setMessage("");
    const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0), 0);
    const rows = items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${currency.format(Number(item.unit_price))}</td><td>${currency.format(Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0))}</td></tr>`).join("") || '<tr><td colspan="4">Nenhum item lançado.</td></tr>';
    const logo = `${window.location.origin}/brand/cr-reparador.jpg`;
    const win = window.open("", "_blank");
    if (!win) {
      setMessage("O navegador bloqueou a abertura do documento. Permita pop-ups para o CR Connect e tente novamente.");
      return;
    }

    win.opener = null;
    win.document.open();
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(type)} ${escapeHtml(number)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#151515;margin:0;padding:20px}.paper{position:relative;min-height:250mm}.watermark{position:fixed;left:50%;top:48%;width:340px;transform:translate(-50%,-50%);opacity:.055;z-index:-1}.toolbar{max-width:210mm;margin:0 auto 16px;padding:12px;border-radius:10px;background:#171717;color:#fff}.toolbar button{border:0;border-radius:7px;background:#f5ae00;padding:10px 14px;font-weight:bold;color:#151515}.toolbar p{margin:8px 0 0;font-size:12px;color:#ddd}.head{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #f5ae00;padding-bottom:14px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:70px;height:70px;border-radius:10px}.brand b{font-size:18px}.label{color:#8a6100;font-size:12px;letter-spacing:1.5px;font-weight:bold}.doc{font-size:27px;font-weight:800}.box{margin-top:22px;border:1px solid #ddd;border-radius:8px;padding:14px;background:#fffdf8}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.muted{font-size:12px;color:#666}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#171717;color:#fff;text-align:left;font-size:12px;padding:10px}td{padding:10px;border-bottom:1px solid #ddd;font-size:13px}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:15px;color:#a66d00}.footer{position:fixed;bottom:0;font-size:10px;color:#777;width:100%;border-top:1px solid #ddd;padding-top:8px}@media print{body{padding:0}.toolbar{display:none}}@media(max-width:600px){.head{display:block}.head>div+div{margin-top:16px}.grid{grid-template-columns:1fr}.watermark{width:260px}}</style></head><body><div class="toolbar"><button onclick="window.print()">Baixar / imprimir PDF</button><p>No celular, toque neste botão e escolha “Salvar como PDF” ou compartilhar.</p></div><main class="paper"><img class="watermark" src="${logo}" alt=""/><header class="head"><div class="brand"><img src="${logo}" alt="CR Reparador"/><div><b>CR REPARADOR AUTOMOTIVO</b><div class="label">CR CONNECT · GESTÃO AUTOMOTIVA</div></div></div><div><div class="label">${escapeHtml(type.toUpperCase())}</div><div class="doc">${escapeHtml(number)}</div><div class="muted">Emitido em ${new Date().toLocaleDateString("pt-BR")}</div></div></header><section class="box grid"><div><div class="label">CLIENTE</div><b>${escapeHtml(client)}</b></div><div><div class="label">VEÍCULO</div><b>${escapeHtml(vehicle)}</b></div><div><div class="label">SITUAÇÃO</div><b>${escapeHtml(status)}</b></div>${note ? `<div><div class="label">OBSERVAÇÕES</div><span>${escapeHtml(note)}</span></div>` : ""}</section><table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total: ${currency.format(total)}</div><footer class="footer">Documento gerado pelo CR Connect · A marca d’água identifica a CR Reparador Automotivo.</footer></main></body></html>`);
    win.document.close();
  }

  return <div><button type="button" onClick={print} className="rounded-lg border border-[#FFC107] px-4 py-2 text-sm font-bold text-[#FFC107] hover:bg-[#261e0b]">Gerar PDF</button>{message && <p className="mt-2 text-sm text-red-400">{message}</p>}</div>;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

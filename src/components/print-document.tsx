"use client";

import QRCode from "qrcode";
import { useState } from "react";

type Line = { description: string; quantity: number; unit_price: number; discount?: number };
type Props = { type: "Orçamento" | "Ordem de Serviço"; number: string; client: string; vehicle: string; status: string; items: Line[]; note?: string | null };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const appUrl = "https://cr-connect-ic3w.vercel.app";
const pixKey = "+5513991320205";
const pixDiscountPercentage = 7;

export function PrintDocument({ type, number, client, vehicle, status, items, note }: Props) {
  const [message, setMessage] = useState("");

  async function print() {
    setMessage("");
    const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0), 0);
    const pixDiscount = type === "Orçamento" ? total * (pixDiscountPercentage / 100) : 0;
    const pixTotal = total - pixDiscount;
    const rows = items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${currency.format(Number(item.unit_price))}</td><td>${currency.format(Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0))}</td></tr>`).join("") || '<tr><td colspan="4">Nenhum item lançado.</td></tr>';
    const logo = `${window.location.origin}/brand/cr-reparador.jpg`;
    const win = window.open("", "_blank");
    if (!win) {
      setMessage("O navegador bloqueou a abertura do documento. Permita pop-ups para o CR Connect e tente novamente.");
      return;
    }

    let appPromo = "";
    let pixPayment = "";
    let cardPayment = "";
    if (type === "Orçamento") {
      try {
        const qrCode = await QRCode.toDataURL(appUrl, { width: 180, margin: 1, color: { dark: "#151515", light: "#ffffff" } });
        appPromo = `<section class="app-promo"><img src="${qrCode}" alt="QR Code para baixar o CR Connect"/><div><div class="label">CR CONNECT</div><strong>BAIXE NOSSO APP</strong><p>Escaneie o QR Code e acompanhe seus serviços de forma rápida e segura.</p><small>${appUrl}</small></div></section>`;
      } catch {
        appPromo = `<section class="app-promo"><div><div class="label">CR CONNECT</div><strong>BAIXE NOSSO APP</strong><p>Acesse ${appUrl} para acompanhar seus serviços.</p></div></section>`;
      }
      try {
        const pixQrCode = await QRCode.toDataURL(createPixPayload(pixTotal, number), { width: 220, margin: 1, color: { dark: "#151515", light: "#ffffff" } });
        pixPayment = `<section class="pix-payment"><img src="${pixQrCode}" alt="QR Code Pix"/><div><div class="label">PAGAMENTO VIA PIX</div><strong>${pixDiscountPercentage}% de desconto no Pix</strong><p>Orçamento: <s>${currency.format(total)}</s> · Desconto: ${currency.format(pixDiscount)}</p><p>Valor no QR Code: <b>${currency.format(pixTotal)}</b></p><small>Escaneie para pagar o valor já preenchido. Chave Pix: 13991320205.</small></div></section>`;
      } catch {
        pixPayment = `<section class="pix-payment"><div class="pix-icon">PIX</div><div><div class="label">PAGAMENTO VIA PIX</div><strong>${pixDiscountPercentage}% de desconto no Pix</strong><p>Valor no Pix: <b>${currency.format(pixTotal)}</b></p><small>Chave Pix: 13991320205.</small></div></section>`;
      }
      try {
        const response = await fetch("/api/checkout-orcamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: total, budgetNumber: number, client }) });
        const result = await response.json().catch(() => ({})) as { publicUrl?: string };
        if (response.ok && typeof result.publicUrl === "string") cardPayment = `<section class="card-payment"><div class="infinite-icon">∞</div><div><div class="label">CR CONNECT + INFINITEPAY</div><strong>Pagamento com cartão</strong><p>Valor no cartão: <b>${currency.format(total)}</b> · sem desconto</p><a href="${escapeHtml(result.publicUrl)}" target="_blank" rel="noopener noreferrer">Abrir pagamento seguro</a></div></section>`;
      } catch { /* O PDF continua disponível mesmo se a criação do checkout falhar. */ }
    }

    const paymentInfo = type === "Ordem de Serviço" ? `<section class="pix-payment"><div class="pix-icon">PIX</div><div><div class="label">PAGAMENTO VIA PIX</div><strong>Chave Pix: 13991320205</strong><p>Valor a pagar: <b>${currency.format(total)}</b></p><small>Chave vinculada à InfinitePay. Envie o comprovante pelo WhatsApp após o pagamento.</small></div></section>` : "";

    win.opener = null;
    win.document.open();
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(type)} ${escapeHtml(number)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#151515;margin:0;padding:20px}.paper{position:relative;min-height:250mm}.watermark{position:fixed;left:50%;top:48%;width:340px;transform:translate(-50%,-50%);opacity:.055;z-index:-1}.toolbar{max-width:210mm;margin:0 auto 16px;padding:12px;border-radius:10px;background:#171717;color:#fff}.toolbar button{border:0;border-radius:7px;background:#f5ae00;padding:10px 14px;font-weight:bold;color:#151515}.toolbar p{margin:8px 0 0;font-size:12px;color:#ddd}.head{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #f5ae00;padding-bottom:14px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:70px;height:70px;border-radius:10px}.brand b{font-size:18px}.label{color:#8a6100;font-size:12px;letter-spacing:1.5px;font-weight:bold}.doc{font-size:27px;font-weight:800}.box{margin-top:22px;border:1px solid #ddd;border-radius:8px;padding:14px;background:#fffdf8}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.muted{font-size:12px;color:#666}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#171717;color:#fff;text-align:left;font-size:12px;padding:10px}td{padding:10px;border-bottom:1px solid #ddd;font-size:13px}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:15px;color:#a66d00}.pix-payment,.card-payment{display:flex;align-items:center;gap:16px;margin-top:24px;border-radius:10px;padding:14px}.pix-payment{border:2px solid #28a886;background:#f2fffb}.card-payment{border:2px solid #151515;background:#f8f8f8}.pix-payment img{width:120px;height:120px;flex:none}.pix-icon,.infinite-icon{display:grid;place-items:center;width:72px;height:72px;border-radius:12px;color:#fff;font-size:25px;font-weight:800}.pix-icon{background:#28a886;font-size:19px;letter-spacing:1px}.infinite-icon{background:#151515}.pix-payment strong,.card-payment strong{display:block;margin-top:3px;font-size:18px}.pix-payment p,.card-payment p{margin:7px 0;font-size:13px}.pix-payment small,.card-payment small{font-size:10px;color:#555}.card-payment a{display:inline-block;margin-top:5px;border-radius:6px;background:#151515;padding:9px 12px;color:#fff;text-decoration:none;font-size:12px;font-weight:bold}.app-promo{display:flex;align-items:center;gap:16px;margin-top:28px;border:2px solid #f5ae00;border-radius:10px;padding:12px;background:#fffaf0}.app-promo img{width:104px;height:104px}.app-promo strong{display:block;margin-top:3px;font-size:20px;color:#151515}.app-promo p{margin:7px 0;color:#444;font-size:12px;line-height:1.4}.app-promo small{font-size:10px;color:#666}.footer{position:fixed;bottom:0;font-size:10px;color:#777;width:100%;border-top:1px solid #ddd;padding-top:8px}@media print{body{padding:0}.toolbar{display:none}}@media(max-width:600px){.head{display:block}.head>div+div{margin-top:16px}.grid{grid-template-columns:1fr}.watermark{width:260px}}</style></head><body><div class="toolbar"><button onclick="window.print()">Baixar / imprimir PDF</button><p>No celular, toque neste botão e escolha “Salvar como PDF” ou compartilhar.</p></div><main class="paper"><img class="watermark" src="${logo}" alt=""/><header class="head"><div class="brand"><img src="${logo}" alt="CR Reparador"/><div><b>CR REPARADOR AUTOMOTIVO</b><div class="label">CR CONNECT · GESTÃO AUTOMOTIVA</div></div></div><div><div class="label">${escapeHtml(type.toUpperCase())}</div><div class="doc">${escapeHtml(number)}</div><div class="muted">Emitido em ${new Date().toLocaleDateString("pt-BR")}</div></div></header><section class="box grid"><div><div class="label">CLIENTE</div><b>${escapeHtml(client)}</b></div><div><div class="label">VEÍCULO</div><b>${escapeHtml(vehicle)}</b></div><div><div class="label">SITUAÇÃO</div><b>${escapeHtml(status)}</b></div>${note ? `<div><div class="label">OBSERVAÇÕES</div><span>${escapeHtml(note)}</span></div>` : ""}</section><table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total: ${currency.format(total)}</div>${pixPayment}${cardPayment}${paymentInfo}${appPromo}<footer class="footer">Documento gerado pelo CR Connect · A marca d’água identifica a CR Reparador Automotivo.</footer></main></body></html>`);
    win.document.close();
  }

  return <div><button type="button" onClick={() => void print()} className="rounded-lg border border-[#FFC107] px-4 py-2 text-sm font-bold text-[#FFC107] hover:bg-[#261e0b]">Gerar PDF</button>{message && <p className="mt-2 text-sm text-red-400">{message}</p>}</div>;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

function createPixPayload(amount: number, budgetNumber: string) {
  const field = (id: string, value: string) => `${id}${value.length.toString().padStart(2, "0")}${value}`;
  const merchantAccount = field("00", "br.gov.bcb.pix") + field("01", pixKey);
  const reference = `ORC${budgetNumber.replace(/[^A-Za-z0-9]/g, "").slice(-16) || "CRCONNECT"}`;
  const payload = [
    field("00", "01"), field("26", merchantAccount), field("52", "0000"), field("53", "986"),
    field("54", Math.max(0, amount).toFixed(2)), field("58", "BR"), field("59", "CR REPARADOR"),
    field("60", "SAO VICENTE"), field("62", field("05", reference)), "6304",
  ].join("");
  return `${payload}${crc16(payload)}`;
}

function crc16(value: string) {
  let crc = 0xffff;
  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

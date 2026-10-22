import { GState, jsPDF } from "jspdf";
import { paymentMethodLabel, paymentTotals, type PaymentData } from "./payment-terms";

type OrderPdf = { number: string; client: string; vehicle: string; status: string; note?: string | null; items: { description: string; quantity: number; unit_price: number; discount?: number }[]; payment?: PaymentData | null };
export type OrderPdfAssets = { logo?: string; pixQr?: string; appQr?: string; checkoutUrl?: string; portalUrl?: string };
const gold = "#987018";
const ink = "#262626";
const grey = "#686868";
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A4 document drawn as text/vectors, without a full-page screenshot on mobile. */
export function createOrderPdf(order: OrderPdf, assets: OrderPdfAssets = {}) {
  const pdf = new jsPDF();
  const left = 18, width = 174, bottom = 276;
  let y = 18;
  pdf.setProperties({ title: `Ordem de Serviço ${order.number}`, author: "CR Reparador Automotivo", subject: "Serviços e condições para conferência do cliente" });
  function font(size = 9, bold = false, color = ink) { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); pdf.setTextColor(color); pdf.setCharSpace(0); }
  function page() {
    if (assets.logo) {
      pdf.saveGraphicsState(); pdf.setGState(new GState({ opacity: .045 }));
      pdf.addImage(assets.logo, "JPEG", 62, 98, 86, 86, "brand"); pdf.restoreGraphicsState();
    }
    font(8, true, gold); pdf.text("CR CONNECT · CR REPARADOR AUTOMOTIVO", left, 13);
    y = 24;
  }
  function ensure(height: number) { if (y + height > bottom) { pdf.addPage(); page(); } }
  function lines(text: string, maxWidth = width - 10, bold = false) { font(9, bold); return pdf.splitTextToSize(text, maxWidth) as string[]; }
  function plain(text: string, bold = false, color = ink) {
    for (const line of lines(text, width, bold)) { ensure(5); font(9, bold, color); pdf.text(line, left, y + 3); y += 4.5; }
    y += 3;
  }
  type Paragraph = { text: string; bold?: boolean; muted?: boolean };
  function box(title: string, paragraphs: Paragraph[], border = "#dddddd", fill = "#fffdf8") {
    const body = paragraphs.flatMap(p => [...lines(p.text, width - 12, p.bold).map(text => ({ ...p, text })), {text: "", bold:false}]);
    while (body.length) {
      ensure(24);
      let capacity = 0, contentHeight = 0;
      for (const line of body) {
        const step = line.text ? 4.2 : 1.6;
        if (contentHeight + step > bottom - y - 15) break;
        contentHeight += step; capacity++;
      }
      const chunk = body.splice(0, Math.max(1, capacity));
      const height = 15 + contentHeight;
      pdf.setDrawColor(border); pdf.setFillColor(fill); pdf.roundedRect(left, y, width, height, 2, 2, "FD");
      font(8, true, gold); pdf.text(title, left + 6, y + 7);
      let row = y + 14;
      for (const line of chunk) { font(9, Boolean(line.bold), line.muted ? grey : ink); pdf.text(line.text, left + 6, row); row += line.text ? 4.2 : 1.6; }
      y += height + 4;
      if (body.length) { pdf.addPage(); page(); }
    }
  }
  page();
  // First-page brand header.
  y = 18;
  if (assets.logo) pdf.addImage(assets.logo, "JPEG", left, y, 19, 19, "brand");
  const brandX = assets.logo ? left + 23 : left;
  font(11, true); pdf.text("CR REPARADOR AUTOMOTIVO", brandX, y + 8);
  font(7, true, gold); pdf.text("CR CONNECT · GESTÃO AUTOMOTIVA", brandX, y + 13);
  font(8, true, gold); pdf.text("ORDEM DE SERVIÇO", 192, y + 3, { align: "right" });
  font(17, true); pdf.text(order.number, 192, y + 11, { align: "right" });
  font(7, false, grey); pdf.text(`Emitido em ${new Date().toLocaleDateString("pt-BR", {timeZone:"America/Sao_Paulo"})}`, 192, y + 16, { align: "right" });
  pdf.setDrawColor("#d5ac45"); pdf.setLineWidth(.6); pdf.line(left, 42, 192, 42); y = 48;
  const clientLines = lines(order.client, 76, true), vehicleLines = lines(order.vehicle, 76, true);
  const infoHeight = 23 + Math.max(clientLines.length, vehicleLines.length) * 4.5 + lines(order.status).length * 4.5;
  if (infoHeight < 110) {
    pdf.setDrawColor("#dddddd"); pdf.setFillColor("#fffdf8"); pdf.roundedRect(left, y, width, infoHeight, 2, 2, "FD");
    font(7, true, gold); pdf.text("CLIENTE", left + 6, y + 7); pdf.text("VEÍCULO", left + 90, y + 7);
    font(9, true); pdf.text(clientLines, left + 6, y + 13); pdf.text(vehicleLines, left + 90, y + 13);
    const statusY = y + 16 + Math.max(clientLines.length, vehicleLines.length) * 4.5;
    font(7, true, gold); pdf.text("SITUAÇÃO", left + 6, statusY); font(9); pdf.text(lines(order.status), left + 6, statusY + 6);
    y += infoHeight + 4;
  } else box("CLIENTE E VEÍCULO", [{text:`Cliente: ${order.client}`,bold:true},{text:`Veículo: ${order.vehicle}`},{text:`Situação: ${order.status}`}]);
  if (order.note) box("OBSERVAÇÕES", [{text:order.note}]);
  function tableHeader() {
    ensure(17); pdf.setFillColor("#262626"); pdf.roundedRect(left, y, width, 9, 1, 1, "F");
    font(8, true, "#ffffff"); pdf.text("Descrição", left + 3, y + 6); pdf.text("Qtd.", 133, y + 6, {align:"right"}); pdf.text("Unitário", 160, y + 6, {align:"right"}); pdf.text("Total", 189, y + 6, {align:"right"}); y += 12;
  }
  tableHeader();
  if (!order.items.length) plain("Nenhum item lançado.");
  for (const item of order.items) {
    const description = lines(item.description, 101);
    if (Number(item.discount)) description.push(...lines(`Desconto no item: ${money(Number(item.discount))}`, 101));
    let first = true;
    while (description.length) {
      if (y + 10 > bottom) { pdf.addPage(); page(); tableHeader(); }
      const available = Math.max(1, Math.floor((bottom - y - 5) / 4.5));
      const chunk = description.splice(0, available);
      font(9); chunk.forEach((line, index) => pdf.text(line, left + 3, y + 4 + index * 4.5));
      if (first) {
        pdf.text(String(item.quantity), 133, y + 4, {align:"right"});
        pdf.text(money(Number(item.unit_price)), 160, y + 4, {align:"right"});
        pdf.text(money(Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0)), 189, y + 4, {align:"right"}); first = false;
      }
      y += Math.max(10, chunk.length * 4.5 + 5); pdf.setDrawColor("#dddddd"); pdf.setLineWidth(.2); pdf.line(left, y - 2, 192, y - 2);
    }
  }
  const subtotal = order.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0), 0);
  const payment = order.payment;
  const { surcharge, total, discount } = paymentTotals(subtotal, payment?.surcharge_percent || 0, payment?.pix_discount_percent || 0);
  ensure(14); font(13, true, gold); pdf.text(`Total: ${money(total)}`, 192, y + 7, {align:"right"}); y += 14;
  const terms: Paragraph[] = [{text:paymentMethodLabel(payment?.payment_method || "not_defined"),bold:true},{text:payment?.payment_terms || "Condições a combinar com o cliente."},{text:`Serviços e peças: ${money(subtotal)} · Acréscimo (${payment?.surcharge_percent || 0}%): ${money(surcharge)}`}];
  if (discount > 0) terms.push({text:`Desconto Pix (${payment?.pix_discount_percent}%): - ${money(discount)}`});
  if (payment?.deferred_without_deposit) terms.push({text:"Retirada sem entrada, com pagamento depois da entrega."});
  if (payment?.surcharge_reason) terms.push({text:`Motivo do acréscimo: ${payment.surcharge_reason}`});
  terms.push({text:`Total combinado: ${money(total)}`,bold:true});
  terms.push({text:payment?.acceptance ? `${payment.acceptance.source === "client_portal" ? "Aceito pelo cliente no portal" : "Aceite informado pela oficina"} em ${new Date(payment.acceptance.at).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})} · ${money(payment.acceptance.total)}` : "Aceite pendente. O cliente deve conferir e aceitar as condições antes do serviço.",muted:true});
  box("CONDIÇÕES DE PAGAMENTO", terms);
  if (assets.portalUrl) {
    ensure(10); font(9, true, gold); pdf.textWithLink("Conferir a O.S. e aceitar as condições no portal do cliente", left + 2, y + 3, {url:assets.portalUrl}); y += 10;
  }
  function promo(title: string, heading: string, description: string, qr?: string, border = "#d5ac45", link?: string) {
    const x = qr ? left + 39 : left + 6, textWidth = qr ? 128 : 162;
    const body = lines(description, textWidth);
    const height = Math.max(34, 22 + body.length * 4.2);
    ensure(height); pdf.setDrawColor(border); pdf.setFillColor("#ffffff"); pdf.roundedRect(left, y, width, height, 2, 2, "FD");
    if (qr) pdf.addImage(qr, "PNG", left + 4, y + 4, 27, 27);
    font(7, true, gold); pdf.text(title, x, y + 7);
    font(11, true); if (link) pdf.textWithLink(heading, x, y + 14, {url:link}); else pdf.text(heading, x, y + 14);
    font(8, false, grey); body.forEach((line, index) => pdf.text(line, x, y + 20 + index * 4.2));
    if (link) pdf.link(left, y, width, height, {url:link});
    y += height + 4;
  }
  if (!payment || ["not_defined", "pix", "combined"].includes(payment.payment_method)) promo("PAGAMENTO VIA PIX", discount > 0 ? `${payment?.pix_discount_percent}% de desconto no Pix` : "Valor combinado no Pix", `${discount > 0 ? `Antes do desconto: ${money(subtotal)}. Desconto: ${money(discount)}. ` : ""}Valor no QR Code: ${money(total)}. Chave Pix: 13991320205.`, assets.pixQr, "#28a886");
  if (payment && ["credit_card", "debit_card", "combined"].includes(payment.payment_method)) promo("CR CONNECT + INFINITEPAY", assets.checkoutUrl ? "Abrir pagamento seguro com cartão" : "Pagamento com cartão", `Valor no cartão: ${money(total)}.${assets.checkoutUrl ? " Toque neste quadro para abrir o pagamento." : " Solicite o link de pagamento à oficina."}`, undefined, "#484848", assets.checkoutUrl);
  promo("CR CONNECT · PORTAL DO CLIENTE", "CONFIRA SUA O.S. NO APP", "Acesse com seu cadastro para acompanhar o atendimento e aceitar as condições combinadas.", assets.appQr, "#d5ac45", assets.portalUrl);
  return pdf;
}

export function finishOrderPdf(pdf: jsPDF) {
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor("#dddddd"); pdf.setLineWidth(.2); pdf.line(18, 282, 192, 282);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(grey);
    pdf.text("Documento gerado pelo CR Connect · CR Reparador Automotivo", 18, 287);
    pdf.text(`${page}/${pages}`, 192, 287, {align:"right"});
  }
}
export async function loadPdfImage(url: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const canvas = document.createElement("canvas");
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("image timeout")), 8000);
      image.onload = () => resolve(); image.onerror = () => reject(new Error("image failed")); image.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d"); if (!context) throw new Error("canvas unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/jpeg", .8), width: canvas.width, height: canvas.height };
  } finally { clearTimeout(timer); image.onload = null; image.onerror = null; image.src = ""; canvas.width = 0; canvas.height = 0; }
}

export async function addMileageToPdf(pdf: jsPDF, url: string, label: string, recordedAt: string) {
  const image = await loadPdfImage(url);
  const ratio = Math.min(174 / image.width, 220 / image.height);
  pdf.addPage(); pdf.setTextColor(ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.text(label, 18, 20);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text(`Registrada em ${new Date(recordedAt).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})}`, 18, 29);
  pdf.addImage(image.data, "JPEG", 18, 38, image.width * ratio, image.height * ratio);
}

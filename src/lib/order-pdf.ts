import { jsPDF } from "jspdf";
import { paymentMethodLabel, paymentTotals, type PaymentData } from "./payment-terms";

type OrderPdf = { number: string; client: string; vehicle: string; status: string; note?: string | null; items: { description: string; quantity: number; unit_price: number; discount?: number }[]; payment?: PaymentData | null };
export function createOrderPdf(order: OrderPdf) {
  const pdf = new jsPDF();
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  let y = 20;
  function text(value: string, bold = false) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    const lines = pdf.splitTextToSize(value, 174) as string[];
    for (const line of lines) {
      if (y > 277) { pdf.addPage(); y = 20; }
      pdf.text(line, 18, y); y += 6;
    }
    y += 3;
  }
  pdf.setFontSize(12);
  text("CR REPARADOR AUTOMOTIVO | CR CONNECT", true);
  text(`Ordem de Serviço ${order.number}`, true);
  text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`);
  text(`Cliente: ${order.client}`); text(`Veículo: ${order.vehicle}`); text(`Situação: ${order.status}`);
  if (order.note) text(`Observações: ${order.note}`);
  text("SERVIÇOS E PEÇAS", true);
  for (const item of order.items) text(`${item.description}\n${item.quantity} x ${money(Number(item.unit_price))} | Total: ${money(Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0))}`);
  if (!order.items.length) text("Nenhum item lançado.");
  const subtotal = order.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0), 0);
  const { surcharge, total } = paymentTotals(subtotal, order.payment?.surcharge_percent || 0);
  text(`Serviços e peças: ${money(subtotal)}`);
  const payment = order.payment;
  if (payment) {
    text(`Acréscimo (${payment.surcharge_percent}%): ${money(surcharge)}`);
    if (payment.surcharge_reason) text(`Motivo do acréscimo: ${payment.surcharge_reason}`);
    text(`Forma de pagamento: ${paymentMethodLabel(payment.payment_method)}`);
    text(`Condições: ${payment.payment_terms || "A combinar"}`);
    text(payment.acceptance ? `${payment.acceptance.source === "client_portal" ? "Aceito pelo cliente no portal" : "Aceite informado pela oficina"} em ${new Date(payment.acceptance.at).toLocaleString("pt-BR")} | ${money(payment.acceptance.total)}` : "Aceite pendente.");
  }
  text(`TOTAL COMBINADO: ${money(total)}`, true);
  if (!payment || ["not_defined", "pix", "combined"].includes(payment.payment_method)) text("Chave Pix: 13991320205");
  return pdf;
}


export async function addMileageToPdf(pdf: jsPDF, url: string, label: string, recordedAt: string) {
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
    const ratio = Math.min(174 / canvas.width, 220 / canvas.height);
    const data = canvas.toDataURL("image/jpeg", .8);
    pdf.addPage(); pdf.text(label, 18, 20);
    pdf.text(`Registrada em ${new Date(recordedAt).toLocaleString("pt-BR")}`, 18, 29);
    pdf.addImage(data, "JPEG", 18, 38, canvas.width * ratio, canvas.height * ratio);
  } finally { clearTimeout(timer); image.onload = null; image.onerror = null; image.src = ""; canvas.width = 0; canvas.height = 0; }
}

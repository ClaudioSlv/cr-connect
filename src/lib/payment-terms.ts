export type PaymentAcceptance = { at: string; source: "client_portal" | "workshop_record"; total: number };
export type PaymentData = { payment_method: string; payment_terms: string; surcharge_percent: number; surcharge_reason: string; pix_discount_percent?: number; deferred_without_deposit?: boolean; available_pix_discount_percent?: number; subtotal: number; total: number; revision: string; acceptance: PaymentAcceptance | null };
export const paymentMethods = [["not_defined", "A combinar"], ["pix", "Pix"], ["cash", "Dinheiro"], ["debit_card", "Cartão de débito"], ["credit_card", "Cartão de crédito"], ["combined", "Pagamento combinado"]] as const;
export const defaultPaymentTerms = "Pagamento na entrega do veículo. Não trabalhamos fiado. Parcelamento somente no cartão, conforme combinado antes do serviço.";
export const paymentMethodLabel = (value: string) => paymentMethods.find(([key]) => key === value)?.[1] || value;
export const paymentMoney = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function paymentTotals(subtotal: number, percentage: number, pixDiscountPercent = 0) {
  const base = Math.round((subtotal + 1e-8) * 100);
  const basisPoints = Math.round(Number(percentage) * 100);
  const surcharge = Number((BigInt(base) * BigInt(basisPoints) + BigInt(5000)) / BigInt(10000));
  const discount = Number((BigInt(base) * BigInt(Math.round((percentage > 0 ? 0 : Number(pixDiscountPercent)) * 100)) + BigInt(5000)) / BigInt(10000));
  return { subtotal: base / 100, surcharge: surcharge / 100, discount: discount / 100, total: (base + surcharge - discount) / 100 };
}
export function parseSurcharge(value: string) {
  if (!/^\d{1,3}([.,]\d{0,2})?$/.test(value.trim())) return null;
  const number = Number(value.trim().replace(",", "."));
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

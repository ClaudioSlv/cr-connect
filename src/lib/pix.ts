const pixKey = "+5513991320205";

export function createPixPayload(amount: number, budgetNumber: string) {
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

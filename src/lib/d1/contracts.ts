export type ErrorPayload = { error: { message: string; code?: string } };
export type SessionUser = { id: string; email: string };
export type Membership = { workshop_id: string; name: string; role: string };
export type ClientInput = {
  full_name: string; document_number: string | null; phone: string | null;
  whatsapp: string | null; email: string | null; notes: string | null;
};
export type ClientRecord = ClientInput & { id: string; workshop_id: string };
export type VehicleInput = {
  client_id: string; plate: string | null; brand: string; model: string;
  version: string | null; year_model: number | null; fuel: string | null;
  engine: string | null; mileage: number | null; notes: string | null;
  timing_belt_changed_at: string | null; timing_belt_changed_mileage: number | null;
  timing_belt_reminder_at: string | null; timing_belt_reminder_mileage: number | null;
};

import { createClient } from "@/lib/supabase/client";
export type MileagePhotoKind = "mileage_initial" | "mileage_final";
export type MileageDrafts = Partial<Record<MileagePhotoKind, File>>;
export type MileagePhoto = { id: string; attachment_kind: MileagePhotoKind; storage_path: string; created_at: string; url?: string };
export const mileagePhotoLabels: Record<MileagePhotoKind,string> = { mileage_initial: "KM inicial · entrada", mileage_final: "KM final · entrega" };
export function validateMileagePhoto(file: Pick<File,"type"|"size">) {
  if (!["image/jpeg","image/png","image/webp","image/heic","image/heif","image/avif","image/gif"].includes(file.type)) return "Escolha uma foto em JPG, PNG, WebP, HEIC, HEIF, AVIF ou GIF.";
  if (file.size <= 0 || file.size > 25 * 1024 * 1024) return "A foto deve ter até 25 MB.";
  return null;
}
export async function loadMileagePhotos(orderId: string): Promise<MileagePhoto[]> {
  const db = createClient();
  const {data,error} = await db.from("attachments").select("id,attachment_kind,storage_path,created_at").eq("service_order_id",orderId).in("attachment_kind",["mileage_initial","mileage_final"]);
  if(error) throw new Error(error.message);
  return Promise.all((data || []).map(async row => {
    const {data:signed,error:signError}=await db.storage.from("workshop-attachments").createSignedUrl(row.storage_path,3600);
    if(signError) throw new Error(signError.message);
    return {...row,url:signed?.signedUrl} as MileagePhoto;
  }));
}
export async function uploadMileagePhoto(workshopId: string,orderId: string,kind: MileagePhotoKind,file: File) {
  const invalid=validateMileagePhoto(file); if(invalid) throw new Error(invalid);
  const db=createClient();
  const {data:old,error:lookupError}=await db.from("attachments").select("id,storage_path").eq("workshop_id",workshopId).eq("service_order_id",orderId).eq("attachment_kind",kind).maybeSingle();
  if(lookupError) throw new Error(lookupError.message);
  const path=`${workshopId}/orders/${orderId}/${kind}/${crypto.randomUUID()}`;
  const {error:uploadError}=await db.storage.from("workshop-attachments").upload(path,file,{contentType:file.type});
  if(uploadError) throw new Error(uploadError.message);
  const payload={workshop_id:workshopId,service_order_id:orderId,attachment_kind:kind,storage_path:path,file_name:file.name,mime_type:file.type,size_bytes:file.size,created_at:new Date().toISOString()};
  const result=old
    ? await db.from("attachments").update(payload).eq("id",old.id).eq("workshop_id",workshopId).select("id").single()
    : await db.from("attachments").insert(payload).select("id").single();
  if(result.error){await db.storage.from("workshop-attachments").remove([path]);throw new Error(result.error.message);}
  if(old) await db.storage.from("workshop-attachments").remove([old.storage_path]);
}

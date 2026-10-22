export type ServiceOrderDraft = { selectedId: string | null; client: string; vehicle: string; status: string; complaint: string; diagnosis: string; note: string; savedAt: number };
export const orderDraftKey = (workshopId:string,userId:string) => `cr-connect:order-camera-draft:${workshopId}:${userId}`;
export function parseOrderDraft(raw:string|null,now=Date.now()):ServiceOrderDraft|null{
  try{
    if(!raw)return null;const value=JSON.parse(raw);
    if(!value||typeof value.savedAt!=="number"||now-value.savedAt>86400000||value.savedAt>now+60000)return null;
    if(value.selectedId!==null&&(typeof value.selectedId!=="string"||!value.selectedId))return null;
    if(!["client","vehicle","status","complaint","diagnosis","note"].every(key=>typeof value[key]==="string"&&value[key].length<=30000))return null;
    return value;
  }catch{return null;}
}

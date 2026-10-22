"use client";
import {MileageCamera} from "@/components/mileage-camera";
import Image from "next/image";
import {useEffect,useRef,useState} from "react";
import {loadMileagePhotos,mileagePhotoLabels,uploadMileagePhoto,validateMileagePhoto,type MileageDrafts,type MileagePhoto,type MileagePhotoKind} from "@/lib/mileage-photos";
const kinds: MileagePhotoKind[]=["mileage_initial","mileage_final"];
export function OrderMileagePhotos({workshopId,orderId,editable=true,drafts,onDraft,onSavedPhoto,refresh=0,disabled=false,onBeforeCapture}:{workshopId?:string;orderId?:string;editable?:boolean;drafts?:MileageDrafts;onDraft?:(kind:MileagePhotoKind,file:File)=>void;onSavedPhoto?:(kind:MileagePhotoKind)=>void;refresh?:number;disabled?:boolean;onBeforeCapture?:()=>void}){
  const [photos,setPhotos]=useState<MileagePhoto[]>([]);
  const [previews,setPreviews]=useState<Partial<Record<MileagePhotoKind,string>>>({});
  const [camera,setCamera]=useState<MileagePhotoKind|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const uploading=useRef(false);
  useEffect(()=>{
    let cancelled=false;
    if(orderId) void loadMileagePhotos(orderId).then(rows=>{if(!cancelled)setPhotos(rows);}).catch(()=>{if(!cancelled)setMessage("Não foi possível carregar as fotos. Abra a O.S. novamente para tentar.");});
    return()=>{cancelled=true;};
  },[orderId,refresh]);
  useEffect(()=>{
    const urls:Partial<Record<MileagePhotoKind,string>>={};
    for(const kind of kinds){const file=drafts?.[kind];if(file)urls[kind]=URL.createObjectURL(file);}
    // Object URLs belong to this effect and are revoked when the draft changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviews(urls);
    return()=>{for(const url of Object.values(urls))if(url)URL.revokeObjectURL(url);};
  },[drafts]);
  async function choose(kind:MileagePhotoKind,file?:File){
    if(!file||uploading.current)return;
    const invalid=validateMileagePhoto(file);if(invalid){setMessage(invalid);return;}
    if(!orderId){onDraft?.(kind,file);setMessage("Foto selecionada. Ela será enviada ao salvar a O.S.");return;}
    if(!workshopId)return;
    if(photos.some(photo=>photo.attachment_kind===kind)&&!window.confirm(`Substituir a foto de ${mileagePhotoLabels[kind]}?`))return;
    uploading.current=true;setBusy(true);setMessage("Enviando foto…");
    try{await uploadMileagePhoto(workshopId,orderId,kind,file);setPhotos(await loadMileagePhotos(orderId));onSavedPhoto?.(kind);setMessage("Foto salva nesta O.S. e disponível no portal do cliente.");}
    catch(error){setMessage(error instanceof Error?error.message:"Não foi possível enviar a foto. Tente novamente.");}
    finally{uploading.current=false;setBusy(false);}
  }
  if(!editable&&!photos.length&&!message)return null;
  return <section className="mt-4 rounded-xl border border-zinc-700 bg-black/20 p-4"><h3 className="font-bold text-[#FFC107]">Registro de quilometragem</h3><p className="mt-2 text-sm text-zinc-300">Foto do painel na entrada e na entrega do veículo.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{kinds.map(kind=>{
    const photo=photos.find(item=>item.attachment_kind===kind);const url=previews[kind]||photo?.url;
    return <article key={kind} className="min-w-0 rounded-lg border border-zinc-700 p-3"><h4 className="font-bold text-zinc-100">{mileagePhotoLabels[kind]}</h4>{url?<a href={url} target="_blank" rel="noreferrer" aria-label={`Ampliar foto ${mileagePhotoLabels[kind]}`}><Image unoptimized width={1600} height={1200} src={url} alt={`Foto do painel: ${mileagePhotoLabels[kind]}`} className="mt-3 max-h-60 w-full rounded object-contain"/></a>:<p className="mt-3 text-sm text-zinc-400">Foto ainda não adicionada.</p>}{photo&&!previews[kind]&&<p className="mt-2 text-xs text-zinc-400">Registrada em {new Date(photo.created_at).toLocaleString("pt-BR")}</p>}{editable&&<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy||disabled} className="rounded-lg border border-[#FFC107] px-3 py-2 text-sm font-bold text-[#FFC107] disabled:opacity-50" onClick={()=>{onBeforeCapture?.();setCamera(kind);}}>Tirar foto</button><label className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-bold">Galeria<input aria-label={`Galeria ${mileagePhotoLabels[kind]}`} disabled={busy||disabled} type="file" accept="image/*" className="sr-only" onClick={()=>onBeforeCapture?.()} onChange={e=>{const file=e.target.files?.[0];e.target.value="";void choose(kind,file);}}/></label></div>}</article>;
  })}</div>{camera&&<MileageCamera key={camera} label={mileagePhotoLabels[camera]} onClose={()=>setCamera(null)} onCapture={file=>{const kind=camera;setCamera(null);void choose(kind,file);}}/>}{message&&<p role="status" className="mt-3 text-sm text-[#FFC107]">{message}</p>}{editable&&!orderId&&<p className="mt-3 text-xs text-zinc-400">A foto inicial pode ser adicionada agora; a final pode ser adicionada ao reabrir a O.S. na entrega.</p>}</section>;
}

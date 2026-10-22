"use client";
import {useEffect,useRef,useState} from "react";
import {captureMileageFrame,mileageCameraConstraints,stopMileageCamera} from "@/lib/mileage-camera";
export function MileageCamera({label,onClose,onCapture}:{label:string;onClose:()=>void;onCapture:(file:File)=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const video=useRef<HTMLVideoElement>(null);
  const stream=useRef<MediaStream|null>(null);
  const active=useRef(false);
  const close=useRef(onClose);
  const [ready,setReady]=useState(false);
  const [capturing,setCapturing]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{close.current=onClose;},[onClose]);
  useEffect(()=>{
    let cancelled=false;active.current=true;
    const modal=dialog.current;const preview=video.current;modal?.showModal();
    void (async()=>{
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error("unsupported");
        const media=await navigator.mediaDevices.getUserMedia(mileageCameraConstraints);
        if(cancelled||document.visibilityState==="hidden"){stopMileageCamera(media);return;}
        stream.current=media;
        if(preview){preview.srcObject=media;await preview.play();}
      }catch(cause){
        stopMileageCamera(stream.current);stream.current=null;
        if(!cancelled)setError(cause instanceof Error&&cause.name==="NotAllowedError"?"Permita o acesso à câmera nas configurações do navegador, ou feche e escolha Galeria.":"Não foi possível abrir a câmera neste navegador. Feche e escolha uma foto pela Galeria.");
      }
    })();
    const hide=()=>{if(document.visibilityState==="hidden"){stopMileageCamera(stream.current);stream.current=null;close.current();}};
    document.addEventListener("visibilitychange",hide);
    return()=>{cancelled=true;active.current=false;document.removeEventListener("visibilitychange",hide);stopMileageCamera(stream.current);stream.current=null;if(preview)preview.srcObject=null;modal?.close();};
  },[]);
  async function capture(){
    if(!video.current||capturing)return;
    setCapturing(true);
    try{
      const file=await captureMileageFrame(video.current);
      stopMileageCamera(stream.current);stream.current=null;
      if(active.current)onCapture(file);
    }catch(cause){if(active.current){setError(cause instanceof Error?cause.message:"Não foi possível capturar a foto.");setCapturing(false);}}
  }
  return <dialog ref={dialog} aria-label={`Câmera: ${label}`} onCancel={event=>{event.preventDefault();if(!capturing)onClose();}} className="fixed inset-0 m-auto w-[calc(100%_-_1rem)] max-w-lg rounded-xl border border-zinc-600 bg-[#111] p-4 text-white backdrop:bg-black/80">
    <h3 className="font-bold text-[#FFC107]">{label}</h3>
    <p className="mt-2 text-sm text-zinc-300">Enquadre a quilometragem do painel e confira se os números estão legíveis.</p>
    <video ref={video} autoPlay playsInline muted onLoadedData={()=>setReady(true)} className="mt-3 max-h-[55dvh] w-full rounded-lg bg-black object-contain"/>
    {error&&<p role="alert" className="mt-3 text-sm text-amber-300">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={!ready||capturing||Boolean(error)} onClick={()=>void capture()} className="rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-50">{capturing?"Capturando…":"Capturar foto"}</button><button type="button" disabled={capturing} onClick={onClose} className="rounded-lg border border-zinc-500 px-4 py-3 font-bold disabled:opacity-50">Fechar</button></div>
  </dialog>;
}

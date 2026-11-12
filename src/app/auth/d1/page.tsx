import { notFound } from "next/navigation";
import { D1Login } from "@/components/d1-login";
export default function ConfirmPage(){ if(process.env.CR_BACKEND!=="d1")notFound();return <D1Login confirm/>;}

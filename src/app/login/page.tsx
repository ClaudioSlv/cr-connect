import LegacyLogin from "@/components/legacy-login";
import { D1Login } from "@/components/d1-login";
export default function LoginPage(){ return process.env.CR_BACKEND === "d1" ? <D1Login/> : <LegacyLogin/>; }

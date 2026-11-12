import type { ErrorPayload } from './contracts';
export async function crRequest<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<{data:T|null;error:ErrorPayload['error']|null}> {
  try {
    const response = await fetch(`/api/cr/${path}`,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
    const result = await response.json() as { data?: T; error?: ErrorPayload["error"] };
    if (!response.ok) return {data:null,error:result.error || {message:'Não foi possível concluir.'}};
    return {data:result.data ?? null,error:null};
  } catch { return {data:null,error:{message:'Sem conexão. Verifique a internet e tente novamente.'}}; }
}

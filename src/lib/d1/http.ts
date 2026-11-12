import { ApiError, createWorkshop, deleteRecord, jsonBody, listRecords, membership, requireOrigin, requireSameOrigin, requireUser, saveRecord, text, type Database } from './service.ts';
import { consumeLogin, requestLogin, signOut, type LoginMail } from './auth.ts';

export type ApiEnvironment = { DB: Database; APP_ORIGIN?: string };
const commonHeaders = { 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff' };
export async function handleApi(request: Request, env: ApiEnvironment, send: LoginMail): Promise<Response> {
  try {
    const origin = requireOrigin(env.APP_ORIGIN,request);
    const url = new URL(request.url); const path = url.pathname.replace(/^\/api\/cr\//,'');
    if (request.method !== 'GET') requireSameOrigin(request,origin);
    if (path === 'auth/request' && request.method === 'POST') {
      const sessionCookie = await requestLogin(env.DB,request,origin,await jsonBody(request),send);
      return Response.json({ok:true},{headers:{...commonHeaders,'Set-Cookie':sessionCookie}});
    }
    if (path === 'auth/confirm' && request.method === 'POST') {
      const result = await consumeLogin(env.DB,request,origin,(await jsonBody(request)).token);
      const headers = new Headers(commonHeaders); headers.append('Set-Cookie',result.sessionCookie); headers.append('Set-Cookie',result.browserCookie);
      return Response.json({ok:true},{headers});
    }
    if (path === 'auth/logout' && request.method === 'POST') return Response.json({ok:true},{headers:{...commonHeaders,'Set-Cookie':await signOut(env.DB,request,origin)}});
    const user = await requireUser(env.DB,request,origin);
    if (path === 'me' && request.method === 'GET') return Response.json({data:{user,membership:await membership(env.DB,user.id)}},{headers:commonHeaders});
    if (path === 'workshops' && request.method === 'POST') {
      // One initial office per account; membership creation is never client supplied.
      if (await membership(env.DB,user.id)) throw new ApiError(409,'Sua oficina já foi criada.');
      const data = await createWorkshop(env.DB,user,await jsonBody(request));
      return Response.json({data},{status:201,headers:commonHeaders});
    }
    const match = /^(clients|vehicles)(?:\/([A-Za-z0-9-]{1,80}))?$/.exec(path);
    if (!match) throw new ApiError(404,'Recurso não encontrado.');
    const resource = match[1] as 'clients'|'vehicles'; const id = match[2];
    const workshopId = text(url.searchParams.get('workshop_id'),'oficina',80,true)!;
    if (request.method === 'GET' && !id) return Response.json({data:await listRecords(env.DB,user.id,workshopId,resource)},{headers:commonHeaders});
    if ((request.method === 'POST' && !id) || (request.method === 'PATCH' && id)) {
      const data = await saveRecord(env.DB,user.id,workshopId,resource,await jsonBody(request),id);
      return Response.json({data},{status:id?200:201,headers:commonHeaders});
    }
    if (request.method === 'DELETE' && id) { await deleteRecord(env.DB,user.id,workshopId,resource,id); return Response.json({ok:true},{headers:commonHeaders}); }
    throw new ApiError(405,'Operação não permitida.');
  } catch (error) {
    if (error instanceof ApiError) return Response.json({error:{message:error.message,code:error.code}},{status:error.status,headers:commonHeaders});
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed')) return Response.json({error:{message:'Já existe um cadastro com este documento ou placa.',code:'23505'}},{status:409,headers:commonHeaders});
    if (message.includes('FOREIGN KEY constraint failed')) return Response.json({error:{message:'Verifique o cliente selecionado e os cadastros vinculados antes de continuar.'}},{status:409,headers:commonHeaders});
    console.error(JSON.stringify({event:'cr_api_failure',type:error instanceof Error?error.name:'unknown'}));
    return Response.json({error:{message:'Não foi possível concluir. Tente novamente.'}},{status:500,headers:commonHeaders});
  }
}

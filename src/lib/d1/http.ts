import { commerceQuery, commerceRpc } from './commerce.ts';
import { passwordAuth } from './password.ts';
import { ApiError, createWorkshop, deleteRecord, jsonBody, listRecords, membership, requireOrigin, requireSameOrigin, requireUser, saveRecord, text, type Database } from './service.ts';
import { consumeLogin, requestLogin, signOut, type LoginMail } from './auth.ts';

export type ApiEnvironment = { DB: Database; APP_ORIGIN?: string; AUTH_METHOD?: string; PASSWORD_PEPPER?: string };
const commonHeaders = { 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff' };
export async function handleApi(request: Request, env: ApiEnvironment, send: LoginMail): Promise<Response> {
  try {
    const origin = requireOrigin(env.APP_ORIGIN,request);
    const url = new URL(request.url); const path = url.pathname.replace(/^\/api\/cr\//,'');
    if (request.method !== 'GET') requireSameOrigin(request,origin);
    const passwordRoute = /^auth\/password\/(register|login|reset)$/.exec(path);
    if (passwordRoute && request.method === 'POST') {
      const result=await passwordAuth(env.DB,request,origin,await jsonBody(request),passwordRoute[1] as 'register'|'login'|'reset',env.PASSWORD_PEPPER);
      return Response.json({data:{recoveryCode:result.recoveryCode}},{status:passwordRoute[1]==='register'?201:200,headers:{...commonHeaders,'Set-Cookie':result.sessionCookie}});
    }
    if(env.AUTH_METHOD==='password' && ['auth/request','auth/confirm'].includes(path))throw new ApiError(404,'Use seu e-mail e sua senha para entrar.');
    if (path === 'auth/request'  && request.method === 'POST') {
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
    if (path === 'commerce/query' && request.method === 'POST') return Response.json({data:await commerceQuery(env.DB,user.id,await jsonBody(request))},{headers:commonHeaders});
    if (path === 'commerce/rpc' && request.method === 'POST') return Response.json({data:await commerceRpc(env.DB,user.id,await jsonBody(request))},{headers:commonHeaders});
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
    if (message.includes('CHECK constraint failed') || message.includes('NOT NULL constraint failed')) return Response.json({error:{message:'Confira os campos obrigatórios, quantidades e valores.'}},{status:400,headers:commonHeaders});
    if (message.includes('UNIQUE constraint failed')) return Response.json({error:{message:'Já existe um cadastro com este documento ou placa.',code:'23505'}},{status:409,headers:commonHeaders});
    if (message.includes('FOREIGN KEY constraint failed')) return Response.json({error:{message:'Verifique o cliente selecionado e os cadastros vinculados antes de continuar.'}},{status:409,headers:commonHeaders});
    console.error(JSON.stringify({event:'cr_api_failure',type:error instanceof Error?error.name:'unknown'}));
    return Response.json({error:{message:'Não foi possível concluir. Tente novamente.'}},{status:500,headers:commonHeaders});
  }
}

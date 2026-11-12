import { handleApi } from '@/lib/d1/http';
import { d1Enabled, platform } from '@/lib/d1/platform';

async function handle(request: Request) {
  if (!d1Enabled()) return Response.json({error:{message:'Recurso indisponível.'}},{status:404});
  const env = await platform();
  return handleApi(request,env,async()=>{throw new Error('Email links are disabled.');});
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;

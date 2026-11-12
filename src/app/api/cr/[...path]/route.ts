import { handleApi } from '@/lib/d1/http';
import { d1Enabled, platform } from '@/lib/d1/platform';
import { mailer } from '@/lib/d1/mail';

async function handle(request: Request) {
  if (!d1Enabled()) return Response.json({error:{message:'Recurso indisponível.'}},{status:404});
  const env = await platform();
  return handleApi(request,env,mailer(env));
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;

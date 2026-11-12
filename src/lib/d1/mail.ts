import 'server-only';
import type { LoginMail } from './auth';

// A verified sender and its API key must be configured as Worker secrets.
export function mailer(config: { RESEND_API_KEY?: string; AUTH_EMAIL_FROM?: string }): LoginMail {
  return async (address,link) => {
    if (!config.RESEND_API_KEY || !config.AUTH_EMAIL_FROM) throw new Error('Email delivery is not configured.');
    const response = await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${config.RESEND_API_KEY}`,'Content-Type':'application/json','User-Agent':'CR-CONNECT/1.0'},
      body:JSON.stringify({from:config.AUTH_EMAIL_FROM,to:[address],subject:'Seu acesso ao CR CONNECT',text:`Para entrar no CR CONNECT, abra este link no mesmo navegador em que pediu o acesso:\n\n${link}\n\nEle vale por 15 minutos e pode ser usado uma única vez. Se você não pediu este acesso, ignore esta mensagem.`}),
      signal:AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Email delivery failed.');
    await response.body?.cancel();
  };
}

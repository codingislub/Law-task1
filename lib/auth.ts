import { NextRequest } from 'next/server';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payload.length % 4;
    const payloadPadded = payload + (pad ? '='.repeat(4 - pad) : '');
    const json = Buffer.from(payloadPadded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: NextRequest): { sub: string; name?: string; email?: string; picture?: string } | null {
  const idToken = req.cookies.get('id_token')?.value;
  if (!idToken) return null;
  const claims = decodeJwtPayload(idToken);
  if (!claims) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && claims.exp < now) return null;
  if (typeof claims.sub !== 'string') return null;
  return { 
    sub: claims.sub, 
    name: typeof claims.name === 'string' ? claims.name : undefined, 
    email: typeof claims.email === 'string' ? claims.email : undefined, 
    picture: typeof claims.picture === 'string' ? claims.picture : undefined 
  };
}

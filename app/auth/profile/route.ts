import { NextRequest, NextResponse } from 'next/server';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const pad = payload.length % 4;
    const payloadPadded = payload + (pad ? '='.repeat(4 - pad) : '');
    const json = Buffer.from(payloadPadded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const idToken = req.cookies.get('id_token')?.value;
  if (!idToken) return new NextResponse(null, { status: 204 });

  const claims = decodeJwtPayload(idToken);
  if (!claims) return new NextResponse(null, { status: 204 });

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && claims.exp < now) {
    return new NextResponse(null, { status: 204 });
  }

  const user = {
    sub: claims.sub,
    name: claims.name || claims.nickname || claims.email,
    email: claims.email,
    picture: claims.picture,
  };
  return NextResponse.json(user);
}

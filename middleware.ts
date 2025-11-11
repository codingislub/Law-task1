import { NextRequest, NextResponse } from 'next/server';

function hasValidIdToken(req: NextRequest): boolean {
  try {
    const token = req.cookies.get('id_token')?.value;
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const pad = payload.length % 4;
    const payloadPadded = payload + (pad ? '='.repeat(4 - pad) : '');
    const json = Buffer.from(payloadPadded, 'base64').toString('utf8');
    const claims = JSON.parse(json);
    if (typeof claims.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!hasValidIdToken(req)) {
      return NextResponse.redirect(new URL('/api/auth/login', req.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};

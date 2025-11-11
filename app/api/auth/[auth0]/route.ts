import { NextRequest, NextResponse } from 'next/server';

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', process.env.AUTH0_CLIENT_ID!);
  body.set('client_secret', process.env.AUTH0_CLIENT_SECRET!);
  body.set('code', code);
  body.set('redirect_uri', redirectUri);

  const resp = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) {
    throw new Error(`Token exchange failed: ${resp.status}`);
  }
  return resp.json() as Promise<{ access_token: string; id_token: string; token_type: string; expires_in: number }>;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ auth0: string }> }) {
  const { auth0: route } = await params;

  switch (route) {
    case 'login': {
      const loginUrl = new URL(`https://${process.env.AUTH0_DOMAIN}/authorize`);
      loginUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID!);
      loginUrl.searchParams.set('response_type', 'code');
      loginUrl.searchParams.set('redirect_uri', `${process.env.APP_BASE_URL}/api/auth/callback`);
      loginUrl.searchParams.set('scope', 'openid profile email');
      return NextResponse.redirect(loginUrl.toString());
    }
    case 'callback': {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      if (!code) {
        return NextResponse.redirect(`${process.env.APP_BASE_URL || '/'}`);
      }

      try {
        const tokens = await exchangeCodeForTokens(code, `${process.env.APP_BASE_URL}/api/auth/callback`);
        const res = NextResponse.redirect(`${process.env.APP_BASE_URL}/dashboard`);
        // Store ID token as session indicator. For a production app, verify and store minimal claims.
        res.cookies.set('id_token', tokens.id_token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: (process.env.APP_BASE_URL || '').startsWith('https://'),
          path: '/',
        });
        return res;
      } catch (e) {
        console.error('[auth callback] token exchange failed', e);
        return NextResponse.redirect(`${process.env.APP_BASE_URL || '/'}`);
      }
    }
    case 'logout': {
      const logoutUrl = new URL(`https://${process.env.AUTH0_DOMAIN}/v2/logout`);
      logoutUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID!);
      logoutUrl.searchParams.set('returnTo', process.env.APP_BASE_URL!);
      const res = NextResponse.redirect(logoutUrl.toString());
      res.cookies.set('id_token', '', { maxAge: 0, path: '/' });
      return res;
    }
    default:
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
 

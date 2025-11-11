import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return new NextResponse(null, { status: 204 });
  }
  // Shape compatible with useUser from @auth0/nextjs-auth0/client
  return NextResponse.json({ user });
}

import { NextRequest, NextResponse } from 'next/server';
import { DeviceSessionManager } from '@/lib/deviceSessionManager';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = user.sub;
    const sessions = DeviceSessionManager.getUserSessions(userId);

    return NextResponse.json({
      sessions: sessions.map(s => ({
        deviceId: s.deviceId,
        userAgent: s.userAgent,
        loginTime: s.loginTime,
        lastActivity: s.lastActivity,
        ipAddress: s.ipAddress,
      })),
      maxDevices: DeviceSessionManager.getMaxDevices(),
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

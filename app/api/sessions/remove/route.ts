import { NextRequest, NextResponse } from 'next/server';
import { DeviceSessionManager } from '@/lib/deviceSessionManager';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { deviceId } = await req.json();
    
    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

  const userId = user.sub;
    const removed = DeviceSessionManager.removeSession(userId, deviceId);

    if (removed) {
      return NextResponse.json({ success: true, message: 'Device logged out successfully' });
    } else {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error removing device:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

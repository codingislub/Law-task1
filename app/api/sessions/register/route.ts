import { NextRequest, NextResponse } from 'next/server';
import { DeviceSessionManager } from '@/lib/deviceSessionManager';
import { v4 as uuidv4 } from 'uuid';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { deviceId, forceDeviceId } = await req.json();
  const userId = user.sub;
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;

    // If forcing logout of another device
    if (forceDeviceId) {
      DeviceSessionManager.removeSession(userId, forceDeviceId);
    }

    // Check if user has reached device limit
    if (DeviceSessionManager.hasReachedLimit(userId) && !forceDeviceId) {
      const sessions = DeviceSessionManager.getUserSessions(userId);
      return NextResponse.json({
        error: 'Device limit reached',
        maxDevices: DeviceSessionManager.getMaxDevices(),
        sessions: sessions.map(s => ({
          deviceId: s.deviceId,
          userAgent: s.userAgent,
          loginTime: s.loginTime,
          lastActivity: s.lastActivity,
        })),
      }, { status: 403 });
    }

    // Check if device already has a session
    const existingDeviceId = deviceId || uuidv4();
    if (!DeviceSessionManager.sessionExists(userId, existingDeviceId)) {
      // Add new device session
      DeviceSessionManager.addSession({
        deviceId: existingDeviceId,
        userId,
        userAgent,
        loginTime: new Date(),
        lastActivity: new Date(),
        ipAddress,
      });
    } else {
      // Update activity for existing session
      DeviceSessionManager.updateActivity(userId, existingDeviceId);
    }

    return NextResponse.json({
      success: true,
      deviceId: existingDeviceId,
    });
  } catch (error) {
    console.error('Error registering device:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const currentDeviceId = deviceId || uuidv4();

    // If forcing logout of another device, ensure it's not the current device
    if (forceDeviceId) {
      if (forceDeviceId === currentDeviceId) {
        // Do not allow forcing logout of the current device; treat as no force
        // and continue with standard limit checks
      } else {
        await DeviceSessionManager.removeSession(userId, forceDeviceId);
      }
    }

    // Check if user has reached device limit
    if (await DeviceSessionManager.hasReachedLimit(userId)) {
      // Allow re-registering/updating the SAME device even when at limit
      if (await DeviceSessionManager.sessionExists(userId, currentDeviceId)) {
        await DeviceSessionManager.updateActivity(userId, currentDeviceId);
        return NextResponse.json({ success: true, deviceId: currentDeviceId });
      }

      // If limit reached and not actually forcing a different device, block and prompt
      if (!forceDeviceId || forceDeviceId === currentDeviceId) {
        const sessions = await DeviceSessionManager.getUserSessions(userId);
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
    }

    // Check if device already has a session
    const existingDeviceId = currentDeviceId;
    if (!(await DeviceSessionManager.sessionExists(userId, existingDeviceId))) {
      // Add new device session
      await DeviceSessionManager.addSession({
        deviceId: existingDeviceId,
        userId,
        userAgent,
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        ipAddress,
      });
    } else {
      // Update activity for existing session
      await DeviceSessionManager.updateActivity(userId, existingDeviceId);
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

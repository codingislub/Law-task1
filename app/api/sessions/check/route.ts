import { NextRequest, NextResponse } from 'next/server';
import { DeviceSessionManager } from '@/lib/deviceSessionManager';
import { getUserFromRequest } from '@/lib/auth';

// Check if current device session is still valid
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ valid: false, reason: 'not_authenticated' });

    const { deviceId } = await req.json();
    
    if (!deviceId) {
      return NextResponse.json({ valid: false, reason: 'no_device_id' });
    }

  const userId = user.sub;
    const sessionExists = DeviceSessionManager.sessionExists(userId, deviceId);

    if (!sessionExists) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'force_logged_out',
        message: 'You have been logged out from another device' 
      });
    }

    // Update activity
    DeviceSessionManager.updateActivity(userId, deviceId);

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error checking session:', error);
    return NextResponse.json({ valid: false, reason: 'error' }, { status: 500 });
  }
}

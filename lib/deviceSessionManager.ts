export interface DeviceSession {
  deviceId: string;
  userId: string;
  userAgent: string;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
}

export interface DeviceSessionStore {
  [userId: string]: DeviceSession[];
}

// In-memory store for device sessions
// In production, this should be stored in a database like Redis or MongoDB
const deviceSessions: DeviceSessionStore = {};

// Configuration
const MAX_DEVICES = parseInt(process.env.MAX_DEVICES || '3');

export class DeviceSessionManager {
  /**
   * Get all active sessions for a user
   */
  static getUserSessions(userId: string): DeviceSession[] {
    return deviceSessions[userId] || [];
  }

  /**
   * Add a new device session
   */
  static addSession(session: DeviceSession): void {
    if (!deviceSessions[session.userId]) {
      deviceSessions[session.userId] = [];
    }
    deviceSessions[session.userId].push(session);
  }

  /**
   * Remove a specific device session
   */
  static removeSession(userId: string, deviceId: string): boolean {
    if (!deviceSessions[userId]) {
      return false;
    }
    
    const initialLength = deviceSessions[userId].length;
    deviceSessions[userId] = deviceSessions[userId].filter(
      (session) => session.deviceId !== deviceId
    );
    
    if (deviceSessions[userId].length === 0) {
      delete deviceSessions[userId];
    }
    
    return deviceSessions[userId]?.length !== initialLength;
  }

  /**
   * Check if user has reached max device limit
   */
  static hasReachedLimit(userId: string): boolean {
    const sessions = this.getUserSessions(userId);
    return sessions.length >= MAX_DEVICES;
  }

  /**
   * Check if a device session exists
   */
  static sessionExists(userId: string, deviceId: string): boolean {
    const sessions = this.getUserSessions(userId);
    return sessions.some((session) => session.deviceId === deviceId);
  }

  /**
   * Update last activity for a device
   */
  static updateActivity(userId: string, deviceId: string): void {
    const sessions = this.getUserSessions(userId);
    const session = sessions.find((s) => s.deviceId === deviceId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Remove all sessions for a user
   */
  static removeAllUserSessions(userId: string): void {
    delete deviceSessions[userId];
  }

  /**
   * Get max devices limit
   */
  static getMaxDevices(): number {
    return MAX_DEVICES;
  }
}

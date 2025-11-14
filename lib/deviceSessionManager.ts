export interface DeviceSession {
  deviceId: string;
  userId: string;
  userAgent: string;
  // stored as ISO strings so they serialize cleanly across Redis / JSON
  loginTime: string;
  lastActivity: string;
  ipAddress?: string;
}

export interface DeviceSessionStore {
  [userId: string]: DeviceSession[];
}

// In-memory store (fallback)
const deviceSessions: DeviceSessionStore = {};

// Optional Redis-backed store (Upstash) for multi-instance deployments
let redisClient: any = null;
const useRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
if (useRedis) {
  try {
    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch {
    console.warn('Upstash Redis not configured or not installed, falling back to in-memory sessions');
  }
}

// Configuration
const MAX_DEVICES = parseInt(process.env.MAX_DEVICES || '3');

export class DeviceSessionManager {
  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<DeviceSession[]> {
    if (redisClient) {
      try {
        const raw = await redisClient.get(`sessions:${userId}`);
        if (!raw) return [];
        const parsed = JSON.parse(raw as string) as DeviceSession[];
        return parsed;
      } catch (e) {
        console.error('[DeviceSessionManager] redis get error', e);
        return deviceSessions[userId] || [];
      }
    }
    return deviceSessions[userId] || [];
  }

  /**
   * Add a new device session
   */
  static async addSession(session: DeviceSession): Promise<void> {
    if (redisClient) {
      try {
        const key = `sessions:${session.userId}`;
        const raw = await redisClient.get(key);
  const arr: DeviceSession[] = raw ? (JSON.parse(raw as string) as DeviceSession[]) : [];
        arr.push(session);
        await redisClient.set(key, JSON.stringify(arr));
        return;
      } catch (e) {
        console.error('[DeviceSessionManager] redis add error', e);
      }
    }

    if (!deviceSessions[session.userId]) {
      deviceSessions[session.userId] = [];
    }
    deviceSessions[session.userId].push(session);
  }

  /**
   * Remove a specific device session
   */
  static async removeSession(userId: string, deviceId: string): Promise<boolean> {
    if (redisClient) {
      try {
        const key = `sessions:${userId}`;
        const raw = await redisClient.get(key);
        if (!raw) return false;
  const arr: DeviceSession[] = (JSON.parse(raw as string) as DeviceSession[]).filter(s => s.deviceId !== deviceId);
        if (arr.length === 0) {
          await redisClient.del(key);
        } else {
          await redisClient.set(key, JSON.stringify(arr));
        }
        return true;
      } catch (e) {
        console.error('[DeviceSessionManager] redis remove error', e);
      }
    }

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
  static async hasReachedLimit(userId: string): Promise<boolean> {
    const sessions = await this.getUserSessions(userId);
    return sessions.length >= MAX_DEVICES;
  }

  /**
   * Check if a device session exists
   */
  static async sessionExists(userId: string, deviceId: string): Promise<boolean> {
    const sessions = await this.getUserSessions(userId);
    return sessions.some((session) => session.deviceId === deviceId);
  }

  /**
   * Update last activity for a device
   */
  static async updateActivity(userId: string, deviceId: string): Promise<void> {
    if (redisClient) {
      try {
        const key = `sessions:${userId}`;
        const raw = await redisClient.get(key);
        if (!raw) return;
  const arr: DeviceSession[] = JSON.parse(raw as string) as DeviceSession[];
        const idx = arr.findIndex((s) => s.deviceId === deviceId);
        if (idx !== -1) {
          arr[idx].lastActivity = new Date().toISOString();
          await redisClient.set(key, JSON.stringify(arr));
        }
        return;
      } catch (e) {
        console.error('[DeviceSessionManager] redis updateActivity error', e);
      }
    }
    const sessions = await this.getUserSessions(userId);
    const session = sessions.find((s) => s.deviceId === deviceId);
    if (session) {
      session.lastActivity = new Date().toISOString();
    }
  }

  /**
   * Remove all sessions for a user
   */
  static async removeAllUserSessions(userId: string): Promise<void> {
    if (redisClient) {
      try {
        await redisClient.del(`sessions:${userId}`);
        return;
      } catch (e) {
        console.error('[DeviceSessionManager] redis removeAll error', e);
      }
    }
    delete deviceSessions[userId];
  }

  /**
   * Get max devices limit
   */
  static getMaxDevices(): number {
    return MAX_DEVICES;
  }
}

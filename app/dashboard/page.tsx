'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface DeviceSession {
  deviceId: string;
  userAgent: string;
  loginTime: string;
  lastActivity: string;
  ipAddress?: string;
}

interface SessionData {
  sessions: DeviceSession[];
  maxDevices: number;
}

export default function Dashboard() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const [deviceId, setDeviceId] = useState<string>('');
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [maxDevices, setMaxDevices] = useState(3);
  const [showForceLogoutModal, setShowForceLogoutModal] = useState(false);
  const [pendingDeviceId, setPendingDeviceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [forceLoggedOut, setForceLoggedOut] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    const storedDeviceId = localStorage.getItem('deviceId');
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
    } else {
      const newDeviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', newDeviceId);
      setDeviceId(newDeviceId);
    }
  }, []);

  const registerDevice = useCallback(async (forceDeviceId?: string) => {
    if (!deviceId || !user) return;

    try {
      const response = await fetch('/api/sessions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, forceDeviceId }),
      });

      const data = await response.json();

      if (response.status === 403 && data.error === 'Device limit reached') {
        setSessions(data.sessions);
        setMaxDevices(data.maxDevices);
        setShowForceLogoutModal(true);
        setPendingDeviceId(deviceId);
        return;
      }

      if (response.ok) {
        setLoading(false);
        loadSessions();
      }
    } catch (error) {
      console.error('Error registering device:', error);
    }
  }, [deviceId, user]);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/sessions');
      if (response.ok) {
        const data: SessionData = await response.json();
        setSessions(data.sessions);
        setMaxDevices(data.maxDevices);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, []);

  const checkSession = useCallback(async () => {
    if (!deviceId || !user) return;

    try {
      const response = await fetch('/api/sessions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });

      const data = await response.json();

      if (!data.valid && data.reason === 'force_logged_out') {
        setForceLoggedOut(true);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  }, [deviceId, user]);

  useEffect(() => {
    if (deviceId && user && !userLoading) {
      registerDevice();
    }
  }, [deviceId, user, userLoading, registerDevice]);

  useEffect(() => {
    if (!user || !deviceId) return;

    const interval = setInterval(() => {
      checkSession();
    }, 5000);

    return () => clearInterval(interval);
  }, [user, deviceId, checkSession]);

  useEffect(() => {
    if (showForceLogoutModal && sessions.length === 0) {
      loadSessions();
    }
  }, [showForceLogoutModal, loadSessions, sessions.length]);

  useEffect(() => {
    if (user) {
      const storedFullName = localStorage.getItem('userFullName');
      const storedPhone = localStorage.getItem('userPhone');
      
      if (storedFullName) setFullName(storedFullName);
      if (storedPhone) setPhoneNumber(storedPhone);
      
      if (!storedFullName || !storedPhone) {
        setIsEditingProfile(true);
      }
    }
  }, [user]);

  const handleForceLogout = async (targetDeviceId: string) => {
    await registerDevice(targetDeviceId);
    setShowForceLogoutModal(false);
    setLoading(false);
  };

  const handleRemoveDevice = async (targetDeviceId: string) => {
    try {
      const response = await fetch('/api/sessions/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: targetDeviceId }),
      });

      if (response.ok) {
        loadSessions();
      }
    } catch (error) {
      console.error('Error removing device:', error);
    }
  };

  const handleLogoutAllOthers = async () => {
    const others = sessions.filter(s => s.deviceId !== deviceId);
    for (const s of others) {
      try {
        await fetch('/api/sessions/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: s.deviceId }),
        });
      } catch (e) {
        // continue best-effort
      }
    }
    loadSessions();
  };

  const handleLogoutCurrentDevice = async () => {
    try {
      await fetch('/api/sessions/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
    } catch {}
    window.location.href = '/api/auth/logout';
  };

  const handleSaveProfile = () => {
    localStorage.setItem('userFullName', fullName);
    localStorage.setItem('userPhone', phoneNumber);
    setIsEditingProfile(false);
  };

  if (userLoading) {
    return (
  <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  if (forceLoggedOut) {
    return (
  <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Expired</h2>
          <p className="text-gray-600 mb-8">
            You have been logged out because your account was accessed from another device that exceeded the maximum device limit.
          </p>
          <a
            href="/api/auth/logout"
            className="inline-flex items-center justify-center w-full px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
          >
            Return to Login
          </a>
        </div>
      </div>
    );
  }

  if (loading || showForceLogoutModal) {
    return (
  <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Device Limit Reached</h2>
            <p className="text-gray-600">
              You have reached the maximum of {maxDevices} concurrent devices. 
              Please select a device to logout to continue.
            </p>
          </div>

          <div className="space-y-4">
            {showForceLogoutModal && sessions.length === 0 && (
              <div className="text-center text-sm text-gray-500">
                <div className="flex justify-center mb-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                </div>
                Fetching your active devices...
                <div className="mt-3">
                  <button
                    onClick={loadSessions}
                    className="px-3 py-2 text-xs border rounded-lg hover:bg-gray-50"
                  >
                    Reload devices
                  </button>
                </div>
              </div>
            )}
            {sessions.map((session) => (
              <div
                key={session.deviceId}
                className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-300 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium text-gray-900">
                      {session.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Device'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 ml-8">
                    Last active: {new Date(session.lastActivity).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleForceLogout(session.deviceId)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Logout This
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setShowForceLogoutModal(false);
              window.location.href = '/api/auth/logout';
            }}
            className="mt-6 w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel Login
          </button>
        </div>
      </div>
    );
  }

  return (
  <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-linear-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                SecureAuth
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <img 
                  src={user.picture || '/default-avatar.png'} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm font-medium text-gray-700">
                  {user.name || user.email}
                </span>
              </div>
              <a
                href="/api/auth/logout"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200"
              >
                Logout
              </a>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
                {!isEditingProfile && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-black"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="flex space-x-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={!fullName || !phoneNumber}
                      className="flex-1 px-6 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save Profile
                    </button>
                    {fullName && phoneNumber && (
                      <button
                        onClick={() => setIsEditingProfile(false)}
                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4 p-4 bg-linear-to-r from-indigo-50 to-purple-50 rounded-xl">
                    <div className="w-16 h-16 bg-linear-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                      {fullName ? fullName.charAt(0).toUpperCase() : user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Full Name</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {fullName || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-500 mb-2">Email Address</p>
                      <p className="text-base font-medium text-gray-900">{user.email}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-500 mb-2">Phone Number</p>
                      <p className="text-base font-medium text-gray-900">
                        {phoneNumber || 'Not provided'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Sessions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Active Devices</h3>
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full">
                  {sessions.length}/{maxDevices}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={handleLogoutAllOthers}
                  disabled={sessions.filter(s => s.deviceId !== deviceId).length === 0}
                  className="px-3 py-2 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-50 text-black"
                >
                  Logout all other devices
                </button>
                <button
                  onClick={handleLogoutCurrentDevice}
                  className="px-3 py-2 text-xs border rounded-lg hover:bg-gray-50 text-black"
                >
                  Logout current device
                </button>
              </div>

              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.deviceId}
                    className={`p-4 rounded-xl border-2 ${
                      session.deviceId === deviceId
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium text-gray-900 text-sm">
                          {session.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}
                        </span>
                      </div>
                      {session.deviceId === deviceId && (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      {new Date(session.lastActivity).toLocaleString()}
                    </p>
                    {session.deviceId !== deviceId && (
                      <button
                        onClick={() => handleRemoveDevice(session.deviceId)}
                        className="w-full px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors font-medium"
                      >
                        Logout Device
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

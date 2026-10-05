export interface AdminUser {
  email: string;
  role: string;
}

export interface SystemStats {
  uptimeSeconds: number;
  memoryUsageMb: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  geminiKeyConfigured: boolean;
  cloudConversionEnabled: boolean;
  activeSessionsCount: number;
  totalTranscriptionsCount: number;
  uploadDirExists: boolean;
  nodeVersion: string;
}

export interface FeaturesConfig {
  cloudConversionEnabled: boolean;
  adminSignInAvailable: boolean;
  onDeviceActive: boolean;
}

const TOKEN_KEY = 'transcriber_admin_token';
const ADMIN_KEY = 'transcriber_admin_user';

export function getStoredAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredAdminUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeAdminSession(token: string, user: AdminUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to store admin session in localStorage:', e);
  }
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  } catch (e) {
    console.error('Failed to clear admin session from localStorage:', e);
  }
}

/**
 * Fetch feature configuration from the server
 */
export async function fetchFeaturesConfig(): Promise<FeaturesConfig> {
  try {
    const res = await fetch('/api/features');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      cloudConversionEnabled: Boolean(data.cloudConversionEnabled),
      adminSignInAvailable: Boolean(data.adminSignInAvailable),
      onDeviceActive: Boolean(data.onDeviceActive),
    };
  } catch {
    // Fallback safe default: cloud conversion disabled, admin enabled
    return {
      cloudConversionEnabled: false,
      adminSignInAvailable: true,
      onDeviceActive: true,
    };
  }
}

/**
 * Authenticate admin with credentials
 */
export async function loginAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; admin?: AdminUser; cloudConversionEnabled?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Invalid administrator credentials.',
      };
    }

    if (data.token && data.admin) {
      storeAdminSession(data.token, data.admin);
    }

    return {
      success: true,
      token: data.token,
      admin: data.admin,
      cloudConversionEnabled: data.cloudConversionEnabled,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error during administrator authentication.',
    };
  }
}

/**
 * Verify current admin session with server
 */
export async function verifyAdminSession(): Promise<{ authenticated: boolean; admin?: AdminUser; cloudConversionEnabled?: boolean }> {
  const token = getStoredAdminToken();
  if (!token) return { authenticated: false };

  try {
    const res = await fetch('/api/admin/session', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      clearAdminSession();
      return { authenticated: false };
    }

    const data = await res.json();
    if (data.authenticated && data.admin) {
      storeAdminSession(token, data.admin);
      return {
        authenticated: true,
        admin: data.admin,
        cloudConversionEnabled: data.cloudConversionEnabled,
      };
    } else {
      clearAdminSession();
      return { authenticated: false };
    }
  } catch {
    // If offline or network glitch, trust existing stored session temporarily
    const storedUser = getStoredAdminUser();
    return { authenticated: Boolean(storedUser), admin: storedUser || undefined };
  }
}

/**
 * Log out admin
 */
export async function logoutAdmin(): Promise<void> {
  const token = getStoredAdminToken();
  clearAdminSession();

  if (token) {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore network errors on logout
    }
  }
}

/**
 * Admin only: Fetch system stats
 */
export async function fetchSystemStats(): Promise<SystemStats | null> {
  const token = getStoredAdminToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/admin/system-stats', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Admin only: Toggle cloud conversion engine
 */
export async function toggleCloudConversion(enabled: boolean): Promise<{ success: boolean; cloudConversionEnabled: boolean; error?: string }> {
  const token = getStoredAdminToken();
  if (!token) {
    return { success: false, cloudConversionEnabled: false, error: 'Unauthorized: Admin session required' };
  }

  try {
    const res = await fetch('/api/admin/toggle-cloud', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        cloudConversionEnabled: !enabled,
        error: data.error || 'Failed to update cloud conversion state.',
      };
    }

    return {
      success: true,
      cloudConversionEnabled: data.cloudConversionEnabled,
    };
  } catch (err: any) {
    return {
      success: false,
      cloudConversionEnabled: !enabled,
      error: err?.message || 'Network error while toggling cloud conversion.',
    };
  }
}

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2,
  Server,
  Info,
} from 'lucide-react';
import { loginAdmin, AdminUser } from '../services/adminAuth';

interface AdminSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (admin: AdminUser, cloudConversionEnabled: boolean) => void;
}

export const AdminSignInModal: React.FC<AdminSignInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('admin@transcriber.internal');
  const [password, setPassword] = useState('AdminPass@2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both admin email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await loginAdmin(email.trim(), password);

    setLoading(false);

    if (result.success && result.admin) {
      onSuccess(result.admin, Boolean(result.cloudConversionEnabled));
      onClose();
    } else {
      setError(result.error || 'Authentication failed. Please verify credentials.');
    }
  };

  return (
    <div
      id="admin-signin-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="admin-signin-modal"
        className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl transition"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm ring-4 ring-zinc-100">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900">Admin Sign In</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                Production RBAC
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Restricted portal for system administration and engine controls
            </p>
          </div>
        </div>

        {/* Notice Info Box */}
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-zinc-800">Administrator Access Only</p>
              <p className="text-[11px] text-zinc-500">
                Cloud conversion option is temporarily paused. Only authenticated administrators can toggle cloud engines or configure server settings.
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Admin Email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="admin-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@transcriber.internal"
                className="w-full rounded-xl border border-zinc-300 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-zinc-700">
                Admin Password
              </label>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                <KeyRound className="h-4 w-4" />
              </div>
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-zinc-300 bg-white py-2 pl-9 pr-10 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Quick preset credentials helper for convenient evaluation */}
          <div className="rounded-lg bg-zinc-100 p-2.5 text-[11px] text-zinc-600 flex items-center justify-between">
            <span className="font-mono text-zinc-500">Default: admin@transcriber.internal</span>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@transcriber.internal');
                setPassword('AdminPass@2026!');
              }}
              className="text-xs font-semibold text-zinc-900 underline hover:text-zinc-700"
            >
              Fill Credentials
            </button>
          </div>

          <div className="pt-2">
            <button
              id="admin-signin-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authenticating Admin...</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Security Footer */}
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            256-bit Token Encryption
          </span>
          <span>Single Admin Authority</span>
        </div>
      </div>
    </div>
  );
};

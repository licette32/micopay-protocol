import { useState } from "react";
import { demoLogin, UserData } from "../services/api";

const DEMO_STELLAR_ADDRESS =
  "GDEMOREVIEWER1111111111111111111111111111111111111111111111";
const DEMO_PASSWORD = "MicoPay-Review-2025";

interface LoginPageProps {
  isDemoMode: boolean;
  onLogin: (user: UserData) => void;
}

const LoginPage = ({ isDemoMode, onLogin }: LoginPageProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await demoLogin();
      onLogin(user);
    } catch {
      setError(
        "Demo login failed. Make sure the API is running with DEMO_MODE=true.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">🍄</span>
          <h1 className="font-headline font-extrabold text-2xl text-on-surface mt-3">
            MicoPay
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Acceso a efectivo físico en México
          </p>
        </div>

        {isDemoMode && (
          <div
            className="mb-6 rounded-xl border border-amber-400 bg-amber-50 p-4"
            data-testid="demo-credentials-label"
          >
            <p className="text-xs font-bold text-amber-800 mb-3 text-center tracking-wide uppercase">
              Demo credentials — for App Store review only
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                  Stellar Address
                </p>
                <input
                  readOnly
                  value={DEMO_STELLAR_ADDRESS}
                  data-testid="demo-stellar-address"
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-mono text-on-surface"
                  aria-label="Demo Stellar address"
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                  Password
                </p>
                <input
                  readOnly
                  value={DEMO_PASSWORD}
                  data-testid="demo-password"
                  className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-mono text-on-surface"
                  aria-label="Demo password"
                />
              </div>
            </div>
          </div>
        )}

        {!isDemoMode && (
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Stellar Address
              </label>
              <input
                data-testid="stellar-address-input"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-mono text-on-surface bg-surface"
                placeholder="G..."
                aria-label="Stellar address"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Password
              </label>
              <input
                type="password"
                data-testid="password-input"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface bg-surface"
                placeholder="••••••••"
                aria-label="Password"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-error text-center mb-4">{error}</p>
        )}

        {isDemoMode && (
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            data-testid="demo-login-button"
            className="w-full h-[52px] bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? "Entrando…" : "🎭 Entrar con Demo Account"}
          </button>
        )}
      </div>
    </div>
  );
};

export default LoginPage;

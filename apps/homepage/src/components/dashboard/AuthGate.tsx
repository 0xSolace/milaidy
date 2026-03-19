import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clearToken,
  cloudLogin,
  cloudLoginPoll,
  isAuthenticated,
  setToken,
} from "../../lib/auth";

type AuthState =
  | "checking"
  | "unauthenticated"
  | "polling"
  | "authenticated"
  | "error";

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    setState(isAuthenticated() ? "authenticated" : "unauthenticated");
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleLogin = useCallback(async () => {
    setState("polling");
    setError(null);
    try {
      const { sessionId, browserUrl } = await cloudLogin();
      window.open(browserUrl, "_blank", "noopener,noreferrer");

      const deadline = Date.now() + 5 * 60 * 1000;
      pollRef.current = setInterval(async () => {
        try {
          if (Date.now() > deadline) {
            clearInterval(pollRef.current);
            setState("error");
            setError("Login timed out. Please try again.");
            return;
          }
          const result = await cloudLoginPoll(sessionId);
          if (result.status === "authenticated" && result.apiKey) {
            clearInterval(pollRef.current);
            setToken(result.apiKey);
            setState("authenticated");
          }
        } catch (err) {
          if (String(err).includes("expired")) {
            clearInterval(pollRef.current);
            setState("error");
            setError("Session expired. Please try again.");
          }
        }
      }, 2000);
    } catch (err) {
      setState("error");
      setError(`Failed to start login: ${err}`);
    }
  }, []);

  const handleSkip = useCallback(() => {
    setState("authenticated");
  }, []);

  if (state === "checking") {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
      </div>
    );
  }

  if (state === "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full animate-fade-up" style={{ animationDelay: "0.1s" }}>
        {/* Logo area */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-border mb-6">
            <img
              src="/logo.png"
              alt="Milady"
              className="w-10 h-10 rounded-lg"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-light mb-3">
            Welcome to Milady Cloud
          </h1>
          <p className="text-text-muted text-[15px] leading-relaxed max-w-sm mx-auto">
            Sign in with Eliza Cloud to create and manage your agents from one place.
          </p>
        </div>

        {state === "polling" ? (
          <div className="text-center space-y-5">
            <div className="inline-flex items-center gap-3 px-5 py-3 bg-surface rounded-xl border border-border">
              <div className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
              <span className="text-text-light text-sm">
                Waiting for authentication…
              </span>
            </div>
            <p className="text-text-muted text-sm">
              Complete the login in the browser tab that opened.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLogin}
              className="w-full px-5 py-3.5 bg-brand text-dark font-medium text-[15px] rounded-xl
                hover:bg-brand-hover active:scale-[0.98] transition-all duration-150
                shadow-[0_0_20px_rgba(240,185,11,0.15)]"
            >
              Sign in with Eliza Cloud
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full px-5 py-3 text-text-muted text-sm rounded-xl
                hover:text-text-light hover:bg-surface transition-all duration-150"
            >
              Continue without account
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 space-y-3">
            <div className="px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
            <button
              type="button"
              onClick={() => setState("unauthenticated")}
              className="w-full px-5 py-3 text-text-muted text-sm rounded-xl
                hover:text-text-light hover:bg-surface transition-all duration-150"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

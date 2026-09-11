// src/pages/ServiceUnavailablePage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ServerCrash, RefreshCw, Mail, Phone } from "lucide-react";
import { checkHealth } from "../services/healthApi";

export default function ServiceUnavailablePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const backTo = location.state?.from || "/";

  // `overriddenReason` is set only when a manual retry fails with a new reason.
  // If it's null, we fall back to whatever the router put in location.state.
  const [overriddenReason, setOverriddenReason] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [countdown, setCountdown] = useState(15);

  // Derived — no effect needed, no setState in an effect body
  const reason =
    overriddenReason ||
    location.state?.reason ||
    "Service is unavailable";

  // Auto-retry every 15 seconds
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 15 : c - 1));
    }, 1000);

    const attempt = setInterval(async () => {
      const res = await checkHealth();
      if (res.ok) {
        clearInterval(tick);
        clearInterval(attempt);
        navigate(backTo, { replace: true });
      }
    }, 15000);

    return () => {
      clearInterval(tick);
      clearInterval(attempt);
    };
  }, [navigate, backTo]);

  const handleRetryNow = async () => {
    setRetrying(true);
    const res = await checkHealth();
    setRetrying(false);

    if (res.ok) {
      navigate(backTo, { replace: true });
    } else {
      setOverriddenReason(res.reason);
      setCountdown(15);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-lg bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <div className="rounded-full bg-error/10 p-4 mb-2">
            <ServerCrash className="w-10 h-10 text-error" />
          </div>

          <h1 className="card-title text-2xl mb-1">Service Unavailable</h1>
          <p className="text-sm text-base-content/60 mb-4">
            The server is currently unreachable or unhealthy.
          </p>

          {reason && (
            <div className="alert alert-error text-sm py-2 mb-4 w-full">
              <span className="truncate">{reason}</span>
            </div>
          )}

          <div className="text-xs text-base-content/50 mb-4">
            Auto-retrying in <strong>{countdown}s</strong>
          </div>

          <button
            className="btn btn-primary gap-2 w-full"
            onClick={handleRetryNow}
            disabled={retrying}
          >
            {retrying ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Retry now
          </button>

          <div className="divider text-xs my-3">
            IF THE PROBLEM PERSISTS
          </div>

          <div className="w-full text-left text-sm space-y-2">
            <p className="text-base-content/70">
              Please contact the system administrator:
            </p>
            <div className="flex items-center gap-2 text-base-content/80">
              <Mail className="w-4 h-4 text-primary" />
              <a
                href="mailto:admin@example.com"
                className="link link-hover"
              >
                admin@example.com
              </a>
            </div>
            <div className="flex items-center gap-2 text-base-content/80">
              <Phone className="w-4 h-4 text-primary" />
              <span>+880 1XXX-XXXXXX</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { checkHealth } from "../services/healthApi";

export default function HealthGate({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [checking, setChecking] = useState(true);

  // Initial health check on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await checkHealth();
      if (cancelled) return;

      if (res.ok) {
        setChecking(false);
        return;
      }

      // Failed → setState in a promise callback (not synchronously in the effect body)
      setChecking(false);
      navigate("/service-unavailable", {
        replace: true,
        state: {
          reason: res.reason,
          from: location.pathname,
        },
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runtime "backend-down" events from the axios interceptor
  useEffect(() => {
    const onDown = (e) => {
      const r = e.detail?.reason || "Backend became unreachable";
      navigate("/service-unavailable", {
        replace: true,
        state: { reason: r, from: location.pathname },
      });
    };
    window.addEventListener("backend-down", onDown);
    return () => window.removeEventListener("backend-down", onDown);
  }, [navigate, location.pathname]);

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <span className="loading loading-spinner loading-lg" />
        <p className="text-sm text-base-content/60">Connecting to server…</p>
      </div>
    );
  }

  return children;
}
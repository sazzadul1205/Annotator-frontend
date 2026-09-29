// src/hooks/usePresenceHeartbeat.js
// The client-side presence heartbeat.
//
// Mounted once at app root (in PublicLayout) so it survives route changes.
// It generates a stable sessionKey per tab, tracks local user activity to
// claim "idle" / "away", and sends a heartbeat on the server-defined interval.
//
// What this deliberately does NOT do:
// - No keystroke logging, no mouse coordinate tracking, no per-event history.
// - The server derives status from lastSeenAt, so a frozen/backgrounded tab
//   stops heartbeating and ages out on its own — no client-side timeout logic
//   can keep a dead tab looking alive.

import { useEffect, useRef, useState, useCallback } from "react";
import { heartbeat } from "../services/presenceApi";
import { useAuth } from "../context/useAuth";

/**
 * @returns {{
 *   status: "active" | "idle" | "away" | "offline" | "unknown",
 *   serverTime: string | null,
 *   activeMsToday: number,
 *   sessions: Array
 * }} The caller's own presence, refreshed on every successful heartbeat.
 */
export default function usePresenceHeartbeat() {
  const { isAuthenticated } = useAuth();
  const [presence, setPresence] = useState({
    status: "unknown",
    serverTime: null,
    activeMsToday: 0,
    sessions: [],
  });

  // Stable per-tab key. Survives reloads within the same tab. Different tabs
  // get different keys so a person annotating on two monitors is two sessions.
  // Use lazy initialization to avoid accessing ref during render.
  const sessionKeyRef = useRef(null);
  const sessionKeyInitialized = useRef(false);

  useEffect(() => {
    if (sessionKeyInitialized.current) return;
    sessionKeyInitialized.current = true;

    const existing = sessionStorage.getItem("annotator_session_key");
    if (existing) {
      sessionKeyRef.current = existing;
    } else {
      const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("annotator_session_key", key);
      sessionKeyRef.current = key;
    }
  }, []);

  const IDLE_DELAY = 45_000; // local idle claim after 45s of no input
  const AWAY_DELAY = 300_000; // local away claim after 5 min of no input (tab hidden)

  // Use lazy initialization for refs that need impure functions
  const lastActivityRef = useRef(null);
  const idleTimerRef = useRef(null);
  const awayTimerRef = useRef(null);
  const hbTimerRef = useRef(null);
  const intervalRef = useRef(15_000); // default; overwritten by first heartbeat response

  // Initialize lastActivityRef on first render
  useEffect(() => {
    if (lastActivityRef.current === null) {
      lastActivityRef.current = Date.now();
    }
  }, []);

  // Activity listener: resets the local idle/away timers.
  const onActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (awayTimerRef.current) clearTimeout(awayTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      // We don't set state here — the heartbeat will send the claimed state.
      // The timer just ensures the *next* heartbeat carries the right claim.
    }, IDLE_DELAY);

    awayTimerRef.current = setTimeout(() => {
      // Same — the heartbeat will send "away" next time.
    }, AWAY_DELAY);
  }, []);

  const claimState = useCallback(() => {
    if (lastActivityRef.current === null) return "active";
    const since = Date.now() - lastActivityRef.current;
    if (since >= AWAY_DELAY) return "away";
    if (since >= IDLE_DELAY) return "idle";
    return "active";
  }, []);

  // The heartbeat itself. Runs on the server-returned interval.
  const tick = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const res = await heartbeat({
        sessionKey: sessionKeyRef.current,
        state: claimState(),
        // We intentionally do NOT send fine-grained action/target here.
        // The annotate page can call heartbeat directly with richer info
        // when the user actually does something annotation-related.
      });
      intervalRef.current = res.heartbeatIntervalMs || 15_000;
      setPresence({
        status: res.status,
        serverTime: res.serverTime,
        activeMsToday: 0, // not in heartbeat response; board fetches separately
        sessions: [],
      });
    } catch (err) {
      // Network error or 401. The 401 interceptor clears the token, so
      // isAuthenticated will flip and the effect will stop. Network errors
      // are silent here — the server will age the session out anyway.
      if (err?.response?.status === 401) return;
      // Any other error: log and continue. A single failed beat does not
      // invalidate the session; the server's offline threshold is the truth.
      // eslint-disable-next-line no-console
      console.debug("[presence] heartbeat failed:", err?.message);
    }
  }, [isAuthenticated, claimState]);

  // Start/stop the interval when auth state changes.
  useEffect(() => {
    if (!isAuthenticated) {
      if (hbTimerRef.current) clearInterval(hbTimerRef.current);
      hbTimerRef.current = null;
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setPresence({ status: "unknown", serverTime: null, activeMsToday: 0, sessions: [] });
      }, 0);
      return;
    }

    // Fire immediately so the tab appears on the board fast.
    tick();

    hbTimerRef.current = setInterval(tick, intervalRef.current);
    return () => {
      if (hbTimerRef.current) clearInterval(hbTimerRef.current);
      hbTimerRef.current = null;
    };
  }, [isAuthenticated, tick]);

  // Activity listeners on mount (once).
  useEffect(() => {
    const ACTIVITY_EVENTS = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "touchmove",
    ];
    for (const ev of ACTIVITY_EVENTS) document.addEventListener(ev, onActivity, { passive: true });
    return () => {
      for (const ev of ACTIVITY_EVENTS) document.removeEventListener(ev, onActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
    };
  }, [onActivity]);

  return presence;
}

/**
 * Sends an enriched heartbeat with the annotator's current action.
 *
 * Call this from the annotate page when the user actually does something
 * (opens an asset, draws a box, saves, etc.). It supplements the
 * background heartbeat without replacing it.
 */
export function sendPresenceAction({ action, targetType, targetId }) {
  const key = sessionStorage.getItem("annotator_session_key");
  if (!key) return Promise.resolve();
  return heartbeat({ sessionKey: key, state: "active", action, targetType, targetId });
}
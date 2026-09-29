// src/services/presenceApi.js
// All presence endpoints. Returns `r.data` like every other service.

import api from "./api";

/**
 * POST /api/presence/heartbeat
 * Any authenticated user. Body: { sessionKey, state, action?, targetType?, targetId? }
 */
export const heartbeat = ({ sessionKey, state, action, targetType, targetId }) =>
  api.post("/presence/heartbeat", { sessionKey, state, action, targetType, targetId })
    .then((r) => r.data);

/**
 * GET /api/presence/me
 * The caller's own presence.
 */
export const getMyPresence = () =>
  api.get("/presence/me").then((r) => r.data);

/**
 * GET /api/presence/board
 * Admin: live team board.
 */
export const getPresenceBoard = () =>
  api.get("/presence/board").then((r) => r.data);

/**
 * GET /api/presence/users/:userId
 * Admin: one annotator's detail.
 */
export const getAnnotatorActivity = (userId, { days = 14 } = {}) =>
  api.get(`/presence/users/${userId}`, { params: { days } }).then((r) => r.data);

/**
 * POST /api/presence/sweep
 * Admin: manual cleanup.
 */
export const sweepPresence = () =>
  api.post("/presence/sweep").then((r) => r.data);
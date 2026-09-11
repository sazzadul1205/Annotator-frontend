// src/services/healthApi.js
import axios from "axios";

// Health check client
const healthClient = axios.create({
  baseURL: "",
  timeout: 5000,
});

// Check health
export async function checkHealth() {
  try {
    const res = await healthClient.get("/health");

    // 200 with success:true → healthy
    if (res.data?.success) {
      return { ok: true };
    }

    // 200 with success:false (unusual, but be safe)
    return { ok: false, reason: res.data?.message || "Unhealthy" };
  } catch (err) {
    const status = err?.response?.status;

    // 503 → server up, DB down
    if (status === 503) {
      return {
        ok: false,
        reason: err?.response?.data?.message || "Database unavailable",
      };
    }

    // No response → server unreachable
    if (!err?.response) {
      return { ok: false, reason: "Cannot reach the server" };
    }

    // Any other status
    return {
      ok: false,
      reason:
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        `Server error (${status})`,
    };
  }
}

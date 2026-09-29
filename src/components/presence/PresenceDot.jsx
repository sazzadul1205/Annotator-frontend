// src/components/presence/PresenceDot.jsx
// A tiny status indicator for the current user's own presence.
// Mounted in PublicLayout so it is visible everywhere.

import usePresenceHeartbeat from "../../hooks/usePresenceHeartbeat";

const STATUS_LABEL = {
  active: "Online",
  idle: "Idle",
  away: "Away",
  offline: "Offline",
  unknown: "—",
};

const STATUS_CLASS = {
  active: "badge-success",
  idle: "badge-warning",
  away: "badge-info",
  offline: "badge-ghost",
  unknown: "badge-ghost",
};

export default function PresenceDot() {
  const { status } = usePresenceHeartbeat();

  return (
    <span
      className={`badge badge-xs gap-1 ${STATUS_CLASS[status] || STATUS_CLASS.unknown}`}
      title={`Your presence: ${STATUS_LABEL[status]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "active"
            ? "bg-success shadow-[0_0_0_3px] shadow-success/20"
            : status === "idle"
              ? "bg-warning"
              : status === "away"
                ? "bg-info"
                : "bg-base-content/30"
        }`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
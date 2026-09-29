// src/pages/TeamActivityPage.jsx
// Live team board: who is annotating right now, how long they've worked
// today, and how much they've finished. Polls on the server heartbeat
// interval so the view is never more than one interval stale.

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Clock,
  CheckCircle2,
  Eye,
  Home,
  Loader2,
  MousePointer2,
  Search,
  User,
  Users,
  Zap,
} from "lucide-react";

import { getPresenceBoard } from "../services/presenceApi";
import { formatTimestamp } from "../lib/format";
import { alertError, confirmAction } from "../lib/swal";

const PRESENCE_QK = ["presence", "board"];

export default function TeamActivityPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [lastServerTime, setLastServerTime] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: PRESENCE_QK,
    queryFn: getPresenceBoard,
    // The initial interval will be updated after the first successful fetch.
    // 10s default; the server returns the real interval in the response.
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });

  // "Now" for relative timestamps — updates every second to avoid
  // impure Date.now() in render. This also keeps the "Xs ago" live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Keep the poll interval in sync with what the server tells us.
  useEffect(() => {
    if (!data?.thresholds?.heartbeatIntervalMs) return;
    queryClient.setQueryDefaults(PRESENCE_QK, {
      refetchInterval: data.thresholds.heartbeatIntervalMs,
    });
  }, [data?.thresholds?.heartbeatIntervalMs, queryClient]);

  // Update the last-fetched timestamp for the "updated Xs ago" line.
  useEffect(() => {
    if (data?.serverTime) {
      // Defer to avoid synchronous setState in effect
      setTimeout(() => setLastServerTime(data.serverTime), 0);
    }
  }, [data?.serverTime]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.rows || [];
    return (data?.rows || []).filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        String(r.outputToday).includes(q),
    );
  }, [data?.rows, search]);

  const totals = useMemo(
    () => ({
      users: data?.totals?.users ?? 0,
      active: data?.totals?.active ?? 0,
      idle: data?.totals?.idle ?? 0,
      away: data?.totals?.away ?? 0,
      offline: data?.totals?.offline ?? 0,
      activeMsToday: data?.totals?.activeMsToday ?? 0,
      outputToday: data?.totals?.outputToday ?? 0,
    }),
    [data?.totals],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            Team Activity
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Live view of who is annotating, how long they've worked, and what
            they've finished. Updates every{" "}
            <code className="bg-base-200 px-1 rounded">
              {data?.thresholds?.heartbeatIntervalMs ?? 10000} ms
            </code>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, email…"
              className="input input-sm input-bordered w-full pl-9 focus:input-primary transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            className="btn btn-ghost btn-sm gap-2"
            onClick={() => refetch()}
            disabled={isLoading}
            title="Force refresh now"
          >
            <Loader2 className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={handleSweep}
            title="Remove sessions older than the retention period"
          >
            <Zap className="w-4 h-4" />
            Sweep Stale
          </button>
        </div>
      </div>

      {/* Totals bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} value={totals.users} label="Total" className="badge-primary" />
        <StatCard
          icon={Activity}
          value={totals.active}
          label="Active now"
          className="badge-success"
        />
        <StatCard icon={Clock} value={totals.idle} label="Idle" className="badge-warning" />
        <StatCard icon={Home} value={totals.away} label="Away" className="badge-info" />
        <StatCard
          icon={CheckCircle2}
          value={formatMs(totals.activeMsToday)}
          label="Active today"
          className="badge-primary"
        />
        <StatCard
          icon={MousePointer2}
          value={totals.outputToday}
          label="Output today"
          className="badge-primary"
        />
      </div>

      {/* Table */}
      <div className="card bg-base-100/80 backdrop-blur-xl shadow-xl border border-base-content/5">
        <div className="card-body p-0">
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="table table-sm">
              <thead>
                <tr className="border-base-content/5">
                  <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold w-28">
                    Status
                  </th>
                  <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                    Annotator
                  </th>
                  <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold w-32">
                    Active today
                  </th>
                  <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold w-28">
                    Output today
                  </th>
                  <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold w-36">
                    Last action
                  </th>
                  <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold w-36">
                    Last seen
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-base-content/50">
                      {search ? `No matches for "${search}"` : "No annotators yet"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.userId} className="border-base-content/5 hover:bg-base-200/40">
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-base-content/40" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{r.name}</p>
                            <p className="text-xs text-base-content/50 truncate">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-sm">
                        {formatMs(r.activeMsToday)}
                      </td>
                      <td className="font-mono text-sm">
                        {r.outputToday} <span className="text-base-content/40">({r.annotationsToday} box{r.annotationsToday !== 1 ? "es" : ""} + {r.commentsToday} comment{r.commentsToday !== 1 ? "s" : ""})</span>
                      </td>
                      <td className="text-xs text-base-content/60 max-w-[200px] truncate">
                        {r.lastAction ? (
                          <>
                            <Eye className="w-3 h-3 inline-block mr-1 text-base-content/40" />
                            {r.lastAction}
                            {r.lastTargetId && (
                              <span className="ml-1 font-mono text-[9px] text-base-content/40">
                                ({r.lastTargetId.slice(0, 8)}…)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-base-content/30">—</span>
                        )}
                      </td>
                      <td className="text-xs text-base-content/50 whitespace-nowrap">
                        {r.lastActiveAt ? formatTimestamp(now - new Date(r.lastActiveAt).getTime()) + " ago" : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: last update timestamp */}
          <div className="p-4 border-t border-base-content/5 flex items-center justify-between">
            <span className="text-[10px] text-base-content/40 font-mono">
              {lastServerTime
                ? `Last update: ${new Date(lastServerTime).toLocaleTimeString()}`
                : "Loading…"}
            </span>
            <span className="text-[10px] text-base-content/40">
              {filtered.length} / {totals.users} annotators
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label }) {
  return (
    <div className="card bg-base-100 border border-base-content/5 p-4 flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 text-base-content/60">
        <Icon className="w-5 h-5" />
        <span className="text-xs uppercase tracking-widest font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: { label: "Active", class: "badge-success", dot: "bg-success shadow-[0_0_0_3px] shadow-success/20" },
    idle: { label: "Idle", class: "badge-warning", dot: "bg-warning" },
    away: { label: "Away", class: "badge-info", dot: "bg-info" },
    offline: { label: "Offline", class: "badge-ghost", dot: "bg-base-content/30" },
  };
  const { label, class: cls, dot } = map[status] || map.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function formatMs(ms) {
  if (!ms || ms < 1000) return "0s";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

async function handleSweep() {
  const ok = await confirmAction(
    "Sweep stale sessions?",
    "Removes sessions older than the retention period. A running tab will simply re-create its session on the next heartbeat.",
    "Sweep",
  );
  if (!ok) return;
  try {
    await import("../services/presenceApi").then((m) => m.sweepPresence());
    alert("Sweep complete");
  } catch (err) {
    alertError("Sweep failed", err?.response?.data?.error || err.message);
  }
}
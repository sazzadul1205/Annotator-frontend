// src/pages/DashboardPage.jsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  LayoutGrid,
  MessageSquare,
  CheckCircle2,
  Clock,
  Users as UsersIcon,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { getDatasetStats } from "../services/datasetApi";

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dataset-stats"],
    queryFn: getDatasetStats,
    refetchInterval: 30000,
  });

  const stats = data?.stats;

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Failed to load stats: {error.message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-base-content/60 mt-1">
          Overview of your annotation workspace.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={LayoutGrid}
          label="Datasets"
          value={stats.totalDatasets}
          color="primary"
        />
        <StatCard
          icon={MessageSquare}
          label="Total comments"
          value={stats.totalComments}
          color="secondary"
        />
        <StatCard
          icon={CheckCircle2}
          label="Annotated"
          value={stats.annotatedComments}
          sub={`${stats.percentAnnotated}%`}
          color="success"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={stats.pendingComments}
          color="warning"
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progress card */}
        <div className="card bg-base-100 shadow-sm border border-base-200 lg:col-span-2">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Overall Progress
              </h2>
              <span className="badge badge-primary">
                {stats.percentAnnotated}%
              </span>
            </div>

            <progress
              className="progress progress-primary w-full h-3"
              value={stats.annotatedComments}
              max={stats.totalComments || 1}
            />

            <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
              <div>
                <div className="text-base-content/50 text-xs">Total</div>
                <div className="font-semibold">{stats.totalComments}</div>
              </div>
              <div>
                <div className="text-base-content/50 text-xs">Annotated</div>
                <div className="font-semibold text-success">
                  {stats.annotatedComments}
                </div>
              </div>
              <div>
                <div className="text-base-content/50 text-xs">Pending</div>
                <div className="font-semibold text-warning">
                  {stats.pendingComments}
                </div>
              </div>
            </div>

            {/* Activity sparkling (bar chart) */}
            {stats.activityLast7Days?.length > 0 && (
              <div className="mt-6">
                <div className="text-xs text-base-content/50 mb-2">
                  Activity · last 7 days
                </div>
                <ActivityBars data={stats.activityLast7Days} />
              </div>
            )}
          </div>
        </div>

        {/* Quick info */}
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <UsersIcon className="w-4 h-4 text-primary" />
              Team
            </h2>
            <div className="text-3xl font-bold">{stats.activeAnnotators}</div>
            <p className="text-xs text-base-content/60">
              active annotator{stats.activeAnnotators === 1 ? "" : "s"}
            </p>

            <div className="divider my-2" />

            <div className="text-xs text-base-content/50 mb-2">
              Datasets by status
            </div>
            <div className="space-y-1 text-sm">
              {Object.entries(stats.datasetsByStatus).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="capitalize text-base-content/70">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>

            <Link to="/datasets" className="btn btn-sm btn-primary mt-4 gap-2">
              View all datasets
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "primary" }) {
  return (
    <div className="card bg-base-100 shadow-sm border border-base-200">
      <div className="card-body p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-base-content/50 uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && (
              <p className="text-xs text-base-content/50 mt-0.5">{sub}</p>
            )}
          </div>
          <div
            className={`w-10 h-10 rounded-lg bg-${color}/10 text-${color} flex items-center justify-center shrink-0`}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityBars({ data }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-1 group"
            title={`${d.date}: ${d.count} changes`}
          >
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full bg-primary/70 group-hover:bg-primary rounded-t transition-all"
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            </div>
            <span className="text-[9px] text-base-content/40">
              {d.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="card bg-base-100 shadow-sm border border-base-200"
          >
            <div className="card-body p-4">
              <div className="skeleton h-3 w-20 mb-2" />
              <div className="skeleton h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="skeleton h-64 rounded-xl lg:col-span-2" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    </div>
  );
}

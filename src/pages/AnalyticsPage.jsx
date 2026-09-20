// src/pages/AnalyticsPage.jsx
import {  useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Heart,
  Type as TypeIcon,
  Download,
  Sparkles,
  Database,
  ArrowLeft,
} from "lucide-react";

import {
  getDatasetAnalytics,
  getGlobalAnalytics,
  exportMLData,
} from "../services/analyticsApi";
import { getDataset } from "../services/datasetApi";
import { toast, alertError } from "../lib/swal";

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

const PALETTE = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

/* ------------------------------------------------------------------ */
/* Page entry                                                          */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const { id } = useParams();
  return id ? <DatasetAnalytics datasetId={id} /> : <GlobalAnalytics />;
}

/* ------------------------------------------------------------------ */
/* Global dashboard (admin)                                            */
/* ------------------------------------------------------------------ */

function GlobalAnalytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics-global"],
    queryFn: getGlobalAnalytics,
    refetchInterval: 30000,
  });

  if (isLoading) return <AnalyticsSkeleton />;
  if (error) {
    return (
      <div className="alert alert-error">
        <span>Failed to load analytics: {error.message}</span>
      </div>
    );
  }

  const o = data.overview;
  const sentiment = data.sentiment.distribution;
  const type = data.type.distribution;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Analytics
        </h1>
        <p className="text-sm text-base-content/60 mt-1">
          Workspace-wide trends and class distributions.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Database}
          label="Datasets"
          value={o.totalDatasets}
          color="primary"
        />
        <KpiCard
          icon={Activity}
          label="Comments"
          value={o.totalComments}
          sub={`${o.annotatedComments} annotated`}
          color="secondary"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Coverage"
          value={`${o.percentAnnotated}%`}
          sub={`${o.pendingComments} pending`}
          color="success"
        />
        <KpiCard
          icon={Sparkles}
          label="Active users"
          value={o.activeUsers}
          sub={`${o.totalUsers} total`}
          color="warning"
        />
      </div>

      {/* Activity line chart */}
      <ChartCard
        icon={TrendingUp}
        title="Activity — last 14 days"
        subtitle="Versions written per day"
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.activityLast14Days}>
            <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => d.slice(5)}
              fontSize={11}
            />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          icon={Heart}
          title="Sentiment distribution"
          subtitle={`Balance score: ${data.sentiment.balanceScore} · Gini ${data.sentiment.gini}`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sentiment}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {sentiment.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={TypeIcon}
          title="Type / Language distribution"
          subtitle={`Balance score: ${data.type.balanceScore} · Gini ${data.type.gini}`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={type}
                dataKey="count"
                nameKey="label"
                outerRadius={90}
                innerRadius={45}
                label={(e) => `${e.label} (${e.count})`}
                labelLine={false}
              >
                {type.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top datasets */}
      <ChartCard
        icon={Database}
        title="Top datasets"
        subtitle="Ranked by comment count"
      >
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="table table-sm">
            <thead>
              <tr className="border-base-content/5">
                <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold">
                  Dataset
                </th>
                <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold text-right">
                  Comments
                </th>
                <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold text-right">
                  Annotated
                </th>
                <th className="bg-transparent text-[10px] uppercase tracking-widest text-base-content/50 font-semibold w-1/3">
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {data.topDatasets.map((d) => (
                <tr key={d._id} className="border-base-content/5">
                  <td>
                    <Link
                      to={`/datasets/${d._id}`}
                      className="link link-hover font-medium"
                    >
                      {d.name}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{d.total}</td>
                  <td className="text-right tabular-nums">{d.annotated}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <progress
                        className="progress progress-primary flex-1 h-1.5"
                        value={d.annotated}
                        max={d.total}
                      />
                      <span className="text-xs tabular-nums w-10 text-right">
                        {d.percent}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dataset dashboard                                                   */
/* ------------------------------------------------------------------ */

function DatasetAnalytics({ datasetId }) {
  const [exporting, setExporting] = useState(null);

  const {
    data: analytics,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["analytics-dataset", datasetId],
    queryFn: () => getDatasetAnalytics(datasetId),
    enabled: !!datasetId,
  });

  const { data: dsData } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDataset(datasetId),
    enabled: !!datasetId,
  });

  const dataset = dsData?.dataset;

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const blob = await exportMLData(datasetId, format, "0.8,0.1,0.1");
      const url = URL.createObjectURL(blob);
      const filename = `${(dataset?.name || "dataset")
        .replace(/\s+/g, "_")
        .slice(0, 40)}-ml.${format === "jsonl" ? "jsonl" : format}`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      toast(`Download started: ${filename}`);
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 0);
    } catch (err) {
      alertError(
        "Export failed",
        err?.response?.data?.error || err.message || "Unknown error",
      );
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) return <AnalyticsSkeleton />;
  if (error) {
    return (
      <div className="alert alert-error">
        <span>Failed to load analytics: {error.message}</span>
      </div>
    );
  }

  const o = analytics.overview;
  const sentiment = analytics.sentiment.distribution;
  const type = analytics.type.distribution;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          to={`/datasets/${datasetId}`}
          className="text-xs link link-hover mb-1 inline-flex items-center gap-1 text-base-content/60"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to dataset
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          {dataset?.name || "Dataset"} — Analytics
        </h1>
        <p className="text-sm text-base-content/60 mt-1">
          {analytics.dataset.taxonomyName
            ? `Using taxonomy "${analytics.dataset.taxonomyName}"`
            : "Using default labels"}
        </p>
      </div>

      {/* Readiness callout */}
      <ReadinessCard readiness={analytics.readiness} />

      {/* Warnings */}
      {analytics.warnings.length > 0 && (
        <div className="space-y-2">
          {analytics.warnings.map((w, i) => (
            <div
              key={i}
              className={`alert ${
                w.severity === "high"
                  ? "alert-error"
                  : w.severity === "medium"
                    ? "alert-warning"
                    : "alert-info"
              } py-2`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Database}
          label="Total"
          value={o.totalComments}
          color="primary"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Annotated"
          value={o.annotatedComments}
          sub={`${o.percentAnnotated}%`}
          color="success"
        />
        <KpiCard
          icon={Activity}
          label="Pending"
          value={o.pendingComments}
          color="warning"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Near-dupes"
          value={o.duplicateCount}
          sub={
            o.totalComments > 0
              ? `${((o.duplicateCount / o.totalComments) * 100).toFixed(1)}%`
              : "0%"
          }
          color={o.duplicateCount > 0 ? "error" : "success"}
        />
      </div>

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          icon={Heart}
          title="Sentiment distribution"
          subtitle={`Balance ${analytics.sentiment.balanceScore} · Entropy ${analytics.sentiment.entropy} · Gini ${analytics.sentiment.gini}`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sentiment}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {sentiment.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          icon={TypeIcon}
          title="Type / Language distribution"
          subtitle={`Balance ${analytics.type.balanceScore} · Entropy ${analytics.type.entropy} · Gini ${analytics.type.gini}`}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={type}
                dataKey="count"
                nameKey="label"
                outerRadius={90}
                innerRadius={45}
                label={(e) => `${e.label} (${e.count})`}
                labelLine={false}
              >
                {type.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Length histogram */}
      <ChartCard
        icon={BarChart3}
        title="Comment length histogram"
        subtitle="Character count buckets — a proxy for text complexity"
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={analytics.lengthHistogram}>
            <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Activity */}
      <ChartCard
        icon={TrendingUp}
        title="Activity timeline"
        subtitle="Versions written per day"
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={analytics.activity}>
            <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => String(d).slice(5)}
              fontSize={11}
            />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ML Export */}
      <ChartCard
        icon={Sparkles}
        title="Export for ML training"
        subtitle="Annotated comments in a format your training pipeline can consume"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => handleExport("jsonl")}
              disabled={exporting !== null}
            >
              {exporting === "jsonl" ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              JSONL
            </button>
            <button
              className="btn btn-sm gap-2"
              onClick={() => handleExport("csv")}
              disabled={exporting !== null}
            >
              {exporting === "csv" ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              CSV
            </button>
            <button
              className="btn btn-sm gap-2"
              onClick={() => handleExport("xlsx")}
              disabled={exporting !== null}
            >
              {exporting === "xlsx" ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              XLSX
            </button>
          </div>

          <div className="rounded-lg bg-base-200/50 border border-base-200 p-3 text-xs space-y-1.5">
            <p className="font-semibold text-base-content/70">
              What's included
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-base-content/60">
              <li>
                Every <strong>annotated</strong> comment with sentiment, type
                and source ID
              </li>
              <li>
                A <code className="font-mono">split</code> column
                (train/val/test) at 80/10/10
              </li>
              <li>Dataset and taxonomy name, for provenance</li>
            </ul>
            <p className="pt-1 text-base-content/50 italic">
              JSONL is one JSON object per line — the format HuggingFace
              <code className="font-mono mx-1">
                datasets.load_dataset("json", ...)
              </code>
              and most trainer scripts expect.
            </p>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

function KpiCard({ icon: Icon, label, value, sub, color = "primary" }) {
  const colorCls = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    error: "bg-error/10 text-error",
  }[color];

  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm">
      <div className="card-body p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-base-content/50">
              {label}
            </p>
            <p className="text-2xl font-bold mt-0.5 tabular-nums">{value}</p>
            {sub && (
              <p className="text-xs text-base-content/50 mt-0.5 truncate">
                {sub}
              </p>
            )}
          </div>
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorCls}`}
          >
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm">
      <div className="card-body p-4 sm:p-5">
        <div className="flex items-start gap-2 mb-3">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">{title}</h3>
            {subtitle && (
              <p className="text-xs text-base-content/50 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReadinessCard({ readiness }) {
  const styles = {
    ready: {
      cls: "border-success/30 bg-success/5",
      badge: "badge-success",
      icon: CheckCircle2,
      label: "Ready for training",
    },
    close: {
      cls: "border-primary/30 bg-primary/5",
      badge: "badge-primary",
      icon: TrendingUp,
      label: "Nearly ready",
    },
    needs_work: {
      cls: "border-warning/30 bg-warning/5",
      badge: "badge-warning",
      icon: AlertTriangle,
      label: "Needs work",
    },
    not_ready: {
      cls: "border-error/30 bg-error/5",
      badge: "badge-error",
      icon: AlertTriangle,
      label: "Not ready",
    },
    empty: {
      cls: "border-base-300 bg-base-200/30",
      badge: "badge-ghost",
      icon: AlertTriangle,
      label: "Empty",
    },
  };
  const info = styles[readiness.level] || styles.empty;
  const Icon = info.icon;

  return (
    <div className={`rounded-xl border p-4 ${info.cls}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-base-100 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{info.label}</span>
            <span className={`badge badge-sm ${info.badge}`}>
              score {readiness.score}/100
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-base-content/70">
            {readiness.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-base-content/40 mt-0.5">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="card bg-base-100 border border-base-200 shadow-sm"
          >
            <div className="card-body p-4 space-y-2">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-7 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="skeleton h-64 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="skeleton h-64 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    </div>
  );
}

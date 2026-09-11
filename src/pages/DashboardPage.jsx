// src/pages/DashboardPage.jsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listDatasets } from "../services/datasetApi";
import { listComments } from "../services/commentApi";
import { useAuth } from "../context/useAuth";


export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Datasets
  const { data: dsData, isLoading: loadingDs } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => listDatasets(),
  });

  // Comment counts by status / sentiment (limit=1 is enough, we only need `total`)
  const { data: pendingData } = useQuery({
    queryKey: ["dash", "pending"],
    queryFn: () => listComments({ status: "pending", limit: 1 }),
  });

  const { data: annotatedData } = useQuery({
    queryKey: ["dash", "annotated"],
    queryFn: () => listComments({ status: "annotated", limit: 1 }),
  });

  const { data: posData } = useQuery({
    queryKey: ["dash", "positive"],
    queryFn: () => listComments({ sentiment: "positive", limit: 1 }),
  });

  const { data: negData } = useQuery({
    queryKey: ["dash", "negative"],
    queryFn: () => listComments({ sentiment: "negative", limit: 1 }),
  });

  const { data: neuData } = useQuery({
    queryKey: ["dash", "neutral"],
    queryFn: () => listComments({ sentiment: "neutral", limit: 1 }),
  });

  const datasets = dsData?.datasets || [];

  const pending = pendingData?.total || 0;
  const annotated = annotatedData?.total || 0;
  const totalComments = pending + annotated;
  const progressPct =
    totalComments > 0 ? Math.round((annotated / totalComments) * 100) : 0;

  const positive = posData?.total || 0;
  const negative = negData?.total || 0;
  const neutral = neuData?.total || 0;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">
          Welcome, {user?.name || "there"}
        </h1>
        <p className="text-sm text-base-content/60">
          Here's what's happening with your annotation work.
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Datasets"
          value={loadingDs ? "…" : datasets.length}
          subtitle="Total uploaded"
          color="primary"
        />
        <StatCard
          title="Total Comments"
          value={totalComments}
          subtitle="Across all datasets"
          color="secondary"
        />
        <StatCard
          title="Pending"
          value={pending}
          subtitle="Waiting for annotation"
          color="warning"
        />
        <StatCard
          title="Annotated"
          value={annotated}
          subtitle="Completed"
          color="success"
        />
      </div>

      {/* Progress + sentiment breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Progress */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base mb-2">Annotation Progress</h2>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-3xl font-bold">{progressPct}%</span>
              <span className="text-sm text-base-content/60">
                {annotated} of {totalComments}
              </span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={annotated}
              max={totalComments || 1}
            />
            <p className="text-xs text-base-content/60 mt-2">
              {pending > 0
                ? `${pending} comment${pending === 1 ? "" : "s"} left to annotate.`
                : totalComments > 0
                  ? "All caught up!"
                  : "No comments imported yet."}
            </p>
          </div>
        </div>

        {/* Sentiment breakdown */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base mb-2">Sentiment Breakdown</h2>
            <SentimentRow label="Positive" value={positive} total={totalComments} color="success" />
            <SentimentRow label="Negative" value={negative} total={totalComments} color="error" />
            <SentimentRow label="Neutral" value={neutral} total={totalComments} color="warning" />
          </div>
        </div>
      </div>

      {/* Recent datasets */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex items-center justify-between mb-2">
            <h2 className="card-title text-base">Recent Datasets</h2>
            <Link to="/datasets" className="btn btn-ghost btn-xs">
              View all
            </Link>
          </div>

          {loadingDs && (
            <div className="flex justify-center py-4">
              <span className="loading loading-spinner" />
            </div>
          )}

          {!loadingDs && datasets.length === 0 && (
            <p className="text-sm text-base-content/60 text-center py-4">
              No datasets yet.
              {isAdmin && (
                <>
                  {" "}
                  <Link to="/datasets" className="link link-primary">
                    Upload one
                  </Link>
                  .
                </>
              )}
            </p>
          )}

          {datasets.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Rows</th>
                    <th>Created</th>
                    <th className="text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.slice(0, 5).map((ds) => (
                    <tr key={ds._id}>
                      <td className="font-medium">{ds.name}</td>
                      <td>
                        <span
                          className={`badge badge-sm ${
                            ds.status === "completed"
                              ? "badge-success"
                              : ds.status === "failed"
                                ? "badge-error"
                                : "badge-warning"
                          }`}
                        >
                          {ds.status}
                        </span>
                      </td>
                      <td className="text-sm">
                        {ds.importedRows}/{ds.totalRows}
                      </td>
                      <td className="text-xs text-base-content/60">
                        {new Date(ds.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/comments?datasetId=${ds._id}`}
                          className="btn btn-xs btn-ghost"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Small components ----------

function StatCard({ title, value, subtitle, color = "primary" }) {
  return (
    <div className={`card bg-base-100 shadow-sm border-l-4 border-${color}`}>
      <div className="card-body py-4">
        <p className="text-xs text-base-content/60">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-xs text-base-content/50">{subtitle}</p>
      </div>
    </div>
  );
}

function SentimentRow({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className={`font-medium text-${color}`}>{label}</span>
        <span className="text-base-content/60">
          {value} ({pct}%)
        </span>
      </div>
      <progress
        className={`progress progress-${color} w-full`}
        value={value}
        max={total || 1}
      />
    </div>
  );
}
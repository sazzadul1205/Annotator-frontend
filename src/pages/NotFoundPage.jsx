// src/pages/NotFoundPage.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ArrowLeft, SearchX } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-lg bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <div className="rounded-full bg-warning/10 p-4 mb-2">
            <SearchX className="w-10 h-10 text-warning" />
          </div>

          <h1 className="text-4xl font-bold tracking-tight">404</h1>
          <h2 className="text-xl font-semibold mt-1">Page Not Found</h2>

          <p className="text-sm text-base-content/60 mt-2 mb-4">
            The page you're looking for doesn't exist or may have been moved.
          </p>

          <div className="w-full text-left bg-base-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-base-content/50 mb-1">
              You tried to visit:
            </p>
            <code className="text-xs font-mono break-all text-base-content/80">
              {location.pathname}
            </code>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              className="btn btn-ghost gap-2 flex-1"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>

            <Link to="/" className="btn btn-primary gap-2 flex-1">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
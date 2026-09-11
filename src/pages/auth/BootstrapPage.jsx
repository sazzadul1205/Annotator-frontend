// src/pages/BootstrapPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getBootstrapStatus, bootstrapAdmin } from "../../services/authApi";

export default function BootstrapPage() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if an admin already exists on page load
  useEffect(() => {
    getBootstrapStatus()
      .then((res) => setAdminExists(res.adminCount > 0))
      .catch(() => setAdminExists(true)) // fail safe
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Password and Confirm Password do not match");
      return;
    }

    setLoading(true);
    try {
      await bootstrapAdmin({ name, email, password, confirmPassword });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.error || err.message || "Bootstrap failed",
      );
    } finally {
      setLoading(false);
    }
  };

  // Loading state while checking
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  // If an admin already exists, don't allow bootstrap
  if (adminExists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
        <div className="card w-full max-w-sm bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <h2 className="card-title justify-center">Admin already exists</h2>
            <p className="text-sm text-base-content/70 mt-2">
              The system has already been initialized. Please log in.
            </p>
            <Link to="/login" className="btn btn-primary mt-4">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Bootstrap form
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl justify-center mb-2">
            Create Admin
          </h2>
          <p className="text-center text-sm text-base-content/60 mb-4">
            First-time setup
          </p>

          {error && (
            <div className="alert alert-error text-sm py-2">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Root Admin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                className="input input-bordered w-full"
                placeholder="admin@test.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Create Admin"
              )}
            </button>
          </form>

          <div className="divider text-xs my-2">OR</div>

          <Link to="/login" className="btn btn-ghost btn-sm w-full">
            Already have an account? Login
          </Link>
        </div>
      </div>
    </div>
  );
}
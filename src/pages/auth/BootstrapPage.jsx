// src/pages/auth/BootstrapPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { ShieldCheck, LogIn } from "lucide-react";
import { getBootstrapStatus, bootstrapAdmin } from "../../services/authApi";

export default function BootstrapPage() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // useWatch is the memoization-safe way to read live field values
  const password = useWatch({ control, name: "password" });

  useEffect(() => {
    getBootstrapStatus()
      .then((res) => setAdminExists(res.adminCount > 0))
      .catch(() => setAdminExists(true))
      .finally(() => setChecking(false));
  }, []);

  const onSubmit = async (values) => {
    setServerError("");
    setLoading(true);
    try {
      await bootstrapAdmin(values);
      navigate("/login", { replace: true });
    } catch (err) {
      setServerError(
        err?.response?.data?.error || err.message || "Bootstrap failed",
      );
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

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

          {serverError && (
            <div className="alert alert-error text-sm py-2">
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Root Admin"
                {...register("name", { required: "Name is required" })}
              />
              {errors.name && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.name.message}
                  </span>
                </label>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                className="input input-bordered w-full"
                placeholder="admin@test.com"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^\S+@\S+\.\S+$/,
                    message: "Invalid email",
                  },
                })}
              />
              {errors.email && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.email.message}
                  </span>
                </label>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="At least 8 characters"
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Must be at least 8 characters",
                  },
                })}
              />
              {errors.password && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.password.message}
                  </span>
                </label>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="Repeat password"
                {...register("confirmPassword", {
                  required: "Please confirm the password",
                  validate: (v) =>
                    v === password || "Passwords do not match",
                })}
              />
              {errors.confirmPassword && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.confirmPassword.message}
                  </span>
                </label>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full mt-2 gap-2"
              disabled={loading}
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Create Admin
                </>
              )}
            </button>
          </form>

          <div className="divider text-xs my-2">OR</div>

          <Link to="/login" className="btn btn-ghost btn-sm w-full gap-1">
            <LogIn className="w-3.5 h-3.5" />
            Already have an account? Login
          </Link>
        </div>
      </div>
    </div>
  );
}
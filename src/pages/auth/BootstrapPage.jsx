// src/pages/auth/BootstrapPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import {
  ShieldCheck,
  LogIn,
  User,
  Mail,
  Lock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { getBootstrapStatus, bootstrapAdmin } from "../../services/authApi";

export default function BootstrapPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [serverError, setServerError] = useState("");
  const [adminExists, setAdminExists] = useState(false);

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

  // Loading state
  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-base-300 via-base-200 to-base-300 gap-3">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-sm text-base-content/60">Checking system status…</p>
      </div>
    );
  }

  // Admin Exists State
  if (adminExists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-base-300 via-base-200 to-base-300 p-4 relative overflow-hidden">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-warning/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />

        <div className="relative w-full max-w-md">
          <div className="card bg-base-100/80 backdrop-blur-xl shadow-2xl border border-base-content/5">
            <div className="card-body items-center text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-warning/15 flex items-center justify-center mb-2">
                <ShieldAlert className="w-7 h-7 text-warning" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">
                Admin already exists
              </h2>
              <p className="text-sm text-base-content/60 mt-1 max-w-xs">
                The system has already been initialized. Please sign in to
                continue.
              </p>
              <Link
                to="/login"
                className="btn btn-primary mt-5 gap-2 shadow-lg shadow-primary/20 group"
              >
                <LogIn className="w-4 h-4" />
                Go to Login
                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-base-content/40 mt-6">
            © {new Date().getFullYear()} Annotator Dashboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-base-300 via-base-200 to-base-300 p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-3">
            <ShieldCheck className="w-7 h-7 text-primary-content" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create your admin account
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            First-time setup for the Annotator Dashboard
          </p>
        </div>

        {/* Card */}
        <div className="card bg-base-100/80 backdrop-blur-xl shadow-2xl border border-base-content/5">
          <div className="card-body p-6 sm:p-8">
            {/* Info banner */}
            <div className="flex items-start gap-2.5 rounded-lg bg-primary/5 border border-primary/10 p-3 mb-2">
              <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-base-content/70 leading-relaxed">
                This form is only available once. The account you create here
                will have full administrative access.
              </p>
            </div>

            {serverError && (
              <div className="alert alert-error text-sm py-2 rounded-lg mb-2">
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Name */}
              <div className="form-control">
                <label className="label pb-1.5">
                  <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                    Name
                  </span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
                  <input
                    type="text"
                    className={`input input-bordered w-full pl-10 focus:input-primary transition-all ${
                      errors.name ? "input-error" : ""
                    }`}
                    placeholder="Root Admin"
                    autoFocus
                    {...register("name", { required: "Name is required" })}
                  />
                </div>
                {errors.name && (
                  <p className="text-error text-xs mt-1.5">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="form-control">
                <label className="label pb-1.5">
                  <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                    Email
                  </span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
                  <input
                    type="email"
                    className={`input input-bordered w-full pl-10 focus:input-primary transition-all ${
                      errors.email ? "input-error" : ""
                    }`}
                    placeholder="admin@test.com"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^\S+@\S+\.\S+$/,
                        message: "Invalid email",
                      },
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="text-error text-xs mt-1.5">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="form-control">
                <label className="label pb-1.5">
                  <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                    Password
                  </span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
                  <input
                    type="password"
                    className={`input input-bordered w-full pl-10 focus:input-primary transition-all ${
                      errors.password ? "input-error" : ""
                    }`}
                    placeholder="At least 8 characters"
                    {...register("password", {
                      required: "Password is required",
                      minLength: {
                        value: 8,
                        message: "Must be at least 8 characters",
                      },
                    })}
                  />
                </div>
                {errors.password && (
                  <p className="text-error text-xs mt-1.5">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="form-control">
                <label className="label pb-1.5">
                  <span className="label-text font-medium text-xs uppercase tracking-wider text-base-content/60">
                    Confirm Password
                  </span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
                  <input
                    type="password"
                    className={`input input-bordered w-full pl-10 focus:input-primary transition-all ${
                      errors.confirmPassword ? "input-error" : ""
                    }`}
                    placeholder="Repeat password"
                    {...register("confirmPassword", {
                      required: "Please confirm the password",
                      validate: (v) =>
                        v === password || "Passwords do not match",
                    })}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-error text-xs mt-1.5">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-2 gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow group"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Create Admin
                    <ArrowRight className="w-4 h-4 ml-auto opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </>
                )}
              </button>
            </form>

            <div className="divider text-[10px] uppercase tracking-widest text-base-content/40 my-1">
              or
            </div>

            <Link
              to="/login"
              className="btn btn-ghost btn-sm w-full gap-2 text-base-content/70 hover:text-base-content normal-case font-normal"
            >
              <LogIn className="w-3.5 h-3.5" />
              Already have an account? Sign in
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-base-content/40 mt-6">
          © {new Date().getFullYear()} Annotator Dashboard
        </p>
      </div>
    </div>
  );
}

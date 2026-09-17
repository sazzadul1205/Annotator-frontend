// src/pages/auth/LoginPage.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { LogIn, Mail, Lock, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "../../context/useAuth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values) => {
    setError("");
    setLoading(true);
    try {
      await login(values.email, values.password);
      navigate("/datasets", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-base-300 via-base-200 to-base-300 p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-3">
            <Sparkles className="w-7 h-7 text-primary-content" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Sign in to your Annotator Dashboard
          </p>
        </div>

        {/* Card */}
        <div className="card bg-base-100/80 backdrop-blur-xl shadow-2xl border border-base-content/5">
          <div className="card-body p-6 sm:p-8">
            {error && (
              <div className="alert alert-error text-sm py-2 mb-2 rounded-lg">
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    autoFocus
                    {...register("email", {
                      required: "Email is required",
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
                    placeholder="••••••••"
                    {...register("password", {
                      required: "Password is required",
                    })}
                  />
                </div>
                {errors.password && (
                  <p className="text-error text-xs mt-1.5">
                    {errors.password.message}
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
                    <LogIn className="w-4 h-4" />
                    Sign in
                    <ArrowRight className="w-4 h-4 ml-auto opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </>
                )}
              </button>
            </form>

            <div className="divider text-[10px] uppercase tracking-widest text-base-content/40 my-1">
              or
            </div>

            <Link
              to="/bootstrap"
              className="btn btn-ghost btn-sm w-full gap-2 text-base-content/70 hover:text-base-content normal-case font-normal"
            >
              First time here? Create admin account
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

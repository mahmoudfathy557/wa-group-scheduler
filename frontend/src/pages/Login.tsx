import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
type FormVals = z.infer<typeof schema>;

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormVals>({
    resolver: zodResolver(schema)
  });

  async function onSubmit(v: FormVals) {
    setBusy(true);
    try {
      await login(v.email, v.password);
      nav("/connect");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 py-8">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Sign in
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Enter your credentials to continue
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email address
          </label>
          <input
            {...register("email")}
            type="email"
            placeholder="you@example.com"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
          {errors.email && (
            <p className="text-red-600 text-xs sm:text-sm mt-1">
              {errors.email.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            type="password"
            {...register("password")}
            placeholder="••••••••"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
          {errors.password && (
            <p className="text-red-600 text-xs sm:text-sm mt-1">
              {errors.password.message}
            </p>
          )}
        </div>
        <button
          disabled={busy}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition text-sm sm:text-base"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <div className="border-t pt-4">
          <p className="text-xs sm:text-sm text-gray-600 text-center">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Create one
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

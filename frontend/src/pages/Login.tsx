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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white p-8 rounded shadow w-full max-w-md space-y-4"
      >
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            {...register("email")}
            className="w-full border rounded px-3 py-2"
          />
          {errors.email && (
            <p className="text-red-600 text-sm">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            {...register("password")}
            className="w-full border rounded px-3 py-2"
          />
          {errors.password && (
            <p className="text-red-600 text-sm">{errors.password.message}</p>
          )}
        </div>
        <button
          disabled={busy}
          className="w-full bg-emerald-600 text-white py-2 rounded disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-sm text-gray-600">
          No account?{" "}
          <Link to="/register" className="text-emerald-700">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}

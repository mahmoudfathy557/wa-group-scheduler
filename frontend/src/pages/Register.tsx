import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import TimezoneSelect from "react-timezone-select";
import { useAuth } from "../hooks/useAuth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Min 8 characters"),
  tenantName: z.string().min(2),
  timezone: z.string().min(1)
});
type FormVals = z.infer<typeof schema>;

export function Register() {
  const { register: doRegister } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    }
  });

  async function onSubmit(v: FormVals) {
    setBusy(true);
    try {
      await doRegister(v.email, v.password, v.tenantName, v.timezone);
      nav("/connect");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Registration failed");
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
          Create workspace
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Set up your WhatsApp scheduler
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Workspace name
          </label>
          <input
            {...register("tenantName")}
            placeholder="My Organization"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
          {errors.tenantName && (
            <p className="text-red-600 text-xs sm:text-sm mt-1">
              {errors.tenantName.message}
            </p>
          )}
        </div>
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <Controller
            name="timezone"
            control={control}
            render={({ field }) => (
              <TimezoneSelect
                value={field.value}
                onChange={(tz) =>
                  field.onChange(typeof tz === "string" ? tz : tz.value)
                }
              />
            )}
          />
        </div>
        <button
          disabled={busy}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition text-sm sm:text-base"
        >
          {busy ? "Creating…" : "Create workspace"}
        </button>
        <div className="border-t pt-4">
          <p className="text-xs sm:text-sm text-gray-600 text-center">
            Already have one?{" "}
            <Link
              to="/login"
              className="font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white p-8 rounded shadow w-full max-w-md space-y-4"
      >
        <h1 className="text-2xl font-semibold">Create your workspace</h1>
        <div>
          <label className="block text-sm mb-1">Workspace name</label>
          <input
            {...register("tenantName")}
            className="w-full border rounded px-3 py-2"
          />
          {errors.tenantName && (
            <p className="text-red-600 text-sm">{errors.tenantName.message}</p>
          )}
        </div>
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
        <div>
          <label className="block text-sm mb-1">Timezone</label>
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
          className="w-full bg-emerald-600 text-white py-2 rounded disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create workspace"}
        </button>
        <p className="text-sm text-gray-600">
          Already have one?{" "}
          <Link to="/login" className="text-emerald-700">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

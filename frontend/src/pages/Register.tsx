import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import TimezoneSelect from "react-timezone-select";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../components/ui/Card";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
  tenantName: z.string().min(2, "Workspace name required"),
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-3xl">Create workspace</CardTitle>
          <CardDescription>Set up your WhatsApp scheduler</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tenantName">Workspace name</Label>
              <Input
                id="tenantName"
                {...register("tenantName")}
                placeholder="My Organization"
              />
              {errors.tenantName && (
                <p className="text-sm text-destructive">
                  {errors.tenantName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                {...register("email")}
                type="email"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
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

            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? "Creating…" : "Create workspace"}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Already have one?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

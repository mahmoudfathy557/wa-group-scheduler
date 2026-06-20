import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { AUTH_UI_TEXT } from "../lib/constants";
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
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required")
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
      toast.error(e?.response?.data?.message || AUTH_UI_TEXT.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-3xl">Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to access WA Scheduler
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? AUTH_UI_TEXT.signingIn : AUTH_UI_TEXT.signIn}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="font-semibold text-primary hover:underline"
                >
                  Create one
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useSocketEvent, getSocket } from "../hooks/useSocket";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "../components/ui/Card";

export function ConnectWhatsApp() {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");

  // Touch the socket so it connects.
  useEffect(() => {
    getSocket();
  }, []);

  const { data: statusData, refetch } = useQuery({
    queryKey: ["wa-status"],
    queryFn: async () =>
      (
        await api.get<{
          status: "connecting" | "connected" | "disconnected";
          qr?: string | null;
        }>("/whatsapp/status")
      ).data,
    refetchInterval: 5000
  });

  useEffect(() => {
    if (!statusData) return;
    setStatus(statusData.status);
    if (statusData.qr) {
      setQr(statusData.qr);
    }
    if (statusData.status === "connected") {
      setQr(null);
    }
  }, [statusData]);

  useSocketEvent<{ qr: string }>("whatsapp:qr", (d) => setQr(d.qr));
  useSocketEvent<{
    status: "connecting" | "connected" | "disconnected";
    reason?: string;
  }>("whatsapp:status", (d) => {
    setStatus(d.status);
    if (d.status === "connected") {
      setQr(null);
      toast.success("WhatsApp connected");
    } else if (d.status === "disconnected") {
      toast(d.reason === "logged_out" ? "Logged out" : "Disconnected");
    }
  });

  async function startConnect() {
    setQr(null);
    await api.post("/whatsapp/connect");
    setStatus("connecting");
    refetch();
  }

  async function disconnect() {
    if (!confirm("Disconnect WhatsApp? Stored credentials will be wiped."))
      return;
    await api.delete("/whatsapp/disconnect");
    setStatus("disconnected");
    setQr(null);
  }

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Connect WhatsApp</CardTitle>
          <CardDescription>
            Status:{" "}
            <span className="font-semibold text-foreground">{status}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "connected" ? (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-emerald-700 font-medium text-sm">
                  Your WhatsApp account is linked and ready.
                </p>
              </div>
              <Button
                onClick={disconnect}
                variant="destructive"
                className="w-full"
              >
                Disconnect WhatsApp
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button onClick={startConnect} className="w-full" size="lg">
                {qr ? "Waiting for scan…" : "Start QR session"}
              </Button>
              {qr && (
                <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center bg-muted">
                  <img
                    src={qr}
                    alt="WhatsApp QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-border rounded"
                  />
                  <p className="text-sm text-muted-foreground mt-4 text-center max-w-xs">
                    Scan this QR code with WhatsApp → Linked Devices on your
                    phone
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 bg-amber-50 border-l-4 border-amber-400 rounded p-4">
            <p className="text-xs sm:text-sm text-amber-800">
              <strong>Security Note:</strong> Using unofficial WhatsApp
              libraries violates their Terms of Service and may result in
              account bans. Use only with test numbers and accept all risks.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useSocketEvent, getSocket } from "../hooks/useSocket";

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
    <div className="bg-white p-6 rounded shadow max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Connect WhatsApp</h2>
      <p className="text-sm text-gray-600 mb-4">
        Status: <span className="font-medium">{status}</span>
      </p>

      {status === "connected" ? (
        <div className="space-y-3">
          <p className="text-emerald-700">Your account is linked.</p>
          <button
            onClick={disconnect}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={startConnect}
            className="bg-emerald-600 text-white px-4 py-2 rounded"
          >
            Start QR session
          </button>
          {qr && (
            <div className="border p-4 inline-block">
              <img src={qr} alt="WhatsApp QR" className="w-64 h-64" />
              <p className="text-xs text-gray-500 mt-2">
                Scan with WhatsApp → Linked Devices
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
        <strong>Note:</strong> Using unofficial WhatsApp libraries violates
        WhatsApp Terms of Service and may result in account bans. Use only with
        throwaway numbers and accept all risk.
      </div>
    </div>
  );
}

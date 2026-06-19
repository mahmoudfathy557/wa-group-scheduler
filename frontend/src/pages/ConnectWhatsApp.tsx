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
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 max-w-full sm:max-w-lg">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
        Connect WhatsApp
      </h2>
      <p className="text-sm sm:text-base text-gray-600 mb-4">
        Status: <span className="font-semibold text-gray-900">{status}</span>
      </p>

      {status === "connected" ? (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 sm:p-4">
            <p className="text-emerald-700 font-medium text-sm">
              Your WhatsApp account is linked and ready.
            </p>
          </div>
          <button
            onClick={disconnect}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm sm:text-base"
          >
            Disconnect WhatsApp
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={startConnect}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm sm:text-base"
          >
            {qr ? "Waiting for scan…" : "Start QR session"}
          </button>
          {qr && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 flex flex-col items-center bg-gray-50">
              <img
                src={qr}
                alt="WhatsApp QR Code"
                className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-gray-200 rounded"
              />
              <p className="text-xs sm:text-sm text-gray-600 mt-4 text-center max-w-xs">
                Scan this QR code with WhatsApp → Linked Devices on your phone
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 sm:mt-8 bg-amber-50 border-l-4 border-amber-400 rounded p-3 sm:p-4">
        <p className="text-xs sm:text-sm text-amber-800">
          <strong>Security Note:</strong> Using unofficial WhatsApp libraries
          violates their Terms of Service and may result in account bans. Use
          only with test numbers and accept all risks.
        </p>
      </div>
    </div>
  );
}

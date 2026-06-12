import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Log {
  id: string;
  scheduleId: string;
  groupJid: string;
  status: "pending" | "sent" | "failed";
  errorReason: string | null;
  whatsappMessageId: string | null;
  createdAt: string;
}

export function Logs() {
  const [status, setStatus] = useState<string>("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs", status],
    queryFn: async () =>
      (await api.get<Log[]>("/logs", { params: status ? { status } : {} }))
        .data,
    refetchInterval: 10000
  });

  return (
    <div className="bg-white p-6 rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Message logs</h2>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={() => refetch()}
            className="border rounded px-3 py-1 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-gray-600">No logs yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left border-b">
            <tr>
              <th className="py-2">Time</th>
              <th>Group</th>
              <th>Status</th>
              <th>Error / Msg ID</th>
            </tr>
          </thead>
          <tbody>
            {data.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="py-2 whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="font-mono text-xs">{l.groupJid}</td>
                <td>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      l.status === "sent"
                        ? "bg-emerald-100 text-emerald-700"
                        : l.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="text-xs text-gray-600">
                  {l.errorReason || l.whatsappMessageId || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Logs auto-pruned after 7 days.
      </p>
    </div>
  );
}

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

interface Group {
  id: string;
  groupJid: string;
  name: string;
}

export function Logs() {
  const [status, setStatus] = useState<string>("");

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await api.get<Group[]>("/groups")).data
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs", status],
    queryFn: async () =>
      (await api.get<Log[]>("/logs", { params: status ? { status } : {} }))
        .data,
    refetchInterval: 10000
  });

  const groupNameByJid = Object.fromEntries(
    (groups ?? []).map((group) => [group.groupJid, group.name])
  );

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 sm:p-6 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Message logs
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition flex-1 sm:flex-none"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <button
              onClick={() => refetch()}
              className="border border-gray-300 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <p className="text-gray-500">Loading logs…</p>
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No logs yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-gray-50 text-left border-b border-gray-200">
                <tr>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700">
                    Time
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden sm:table-cell">
                    Group
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden md:table-cell">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-0 py-3">
                      <p className="text-gray-900 font-medium text-xs sm:text-sm">
                        {new Date(l.createdAt).toLocaleString()}
                      </p>
                      <div className="sm:hidden text-xs text-gray-500 mt-1 break-all">
                        {groupNameByJid[l.groupJid] || l.groupJid}
                      </div>
                    </td>
                    <td className="px-4 sm:px-0 py-3 font-mono text-xs text-gray-600 hidden sm:table-cell break-all max-w-xs">
                      {groupNameByJid[l.groupJid] || l.groupJid}
                    </td>
                    <td className="px-4 sm:px-0 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
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
                    <td className="px-4 sm:px-0 py-3 text-xs text-gray-600 hidden md:table-cell break-all">
                      {l.errorReason || l.whatsappMessageId || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 bg-gray-50 border-t text-xs text-gray-500">
        Logs auto-pruned after 7 days.
      </div>
    </div>
  );
}

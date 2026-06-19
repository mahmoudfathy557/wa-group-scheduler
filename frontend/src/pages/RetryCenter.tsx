import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";

interface Log {
  id: string;
  scheduleId: string;
  groupJid: string;
  status: "pending" | "sent" | "failed";
  errorReason: string | null;
  whatsappMessageId: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

interface Group {
  id: string;
  groupJid: string;
  name: string;
}

export function RetryCenter() {
  const [clearError, setClearError] = useState<string>("");

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await api.get<Group[]>("/groups")).data
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["retry-center-logs"],
    queryFn: async () => (await api.get<Log[]>("/logs")).data,
    refetchInterval: 10000
  });

  const resendMutation = useMutation({
    mutationFn: async (logId: string) => {
      await api.post(`/logs/${logId}/resend`);
    },
    onSuccess: async () => {
      toast.success("Message sent!");
      await refetch();
    }
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      await api.post("/logs/clear-view");
    },
    onSuccess: async () => {
      setClearError("");
      await refetch();
      toast.success("Logs cleared from view");
    },
    onError: () => {
      setClearError("Could not clear logs right now. Please try again.");
    }
  });

  const actionableLogs = (data ?? []).filter(
    (log) => log.status === "pending" || log.status === "failed"
  );

  const groupNameByJid = Object.fromEntries(
    (groups ?? []).map((group) => [group.groupJid, group.name])
  );

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 sm:p-6 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Retry center
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Resend pending or failed messages from a dedicated action view.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => refetch()}
              className="border border-gray-300 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition"
            >
              ↻ Refresh
            </button>
            <button
              onClick={() => clearLogsMutation.mutate()}
              disabled={clearLogsMutation.isPending}
              className="border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-lg px-4 py-2 text-sm font-medium text-amber-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {clearLogsMutation.isPending ? "Clearing..." : "Clear from view"}
            </button>
          </div>
        </div>
        {clearError ? (
          <p className="text-sm text-red-600 mt-3">{clearError}</p>
        ) : null}
      </div>

      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <p className="text-gray-500">Loading retry items…</p>
          </div>
        ) : actionableLogs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No pending or failed messages right now.
          </p>
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
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden lg:table-cell">
                    Next retry
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden md:table-cell">
                    Details
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {actionableLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-0 py-3">
                      <p className="text-gray-900 font-medium text-xs sm:text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                      <div className="sm:hidden text-xs text-gray-500 mt-1 break-all">
                        {groupNameByJid[log.groupJid] || log.groupJid}
                      </div>
                    </td>
                    <td className="px-4 sm:px-0 py-3 font-mono text-xs text-gray-600 hidden sm:table-cell break-all max-w-xs">
                      {groupNameByJid[log.groupJid] || log.groupJid}
                    </td>
                    <td className="px-4 sm:px-0 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                          log.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {log.status}
                      </span>
                      <div className="lg:hidden text-xs text-gray-500 mt-1">
                        Next:{" "}
                        {log.nextRetryAt
                          ? new Date(log.nextRetryAt).toLocaleString()
                          : "Unknown"}
                      </div>
                    </td>
                    <td className="px-4 sm:px-0 py-3 text-xs text-gray-600 hidden lg:table-cell">
                      {log.nextRetryAt
                        ? new Date(log.nextRetryAt).toLocaleString()
                        : "Unknown"}
                    </td>
                    <td className="px-4 sm:px-0 py-3 text-xs text-gray-600 hidden md:table-cell break-all">
                      {log.errorReason || log.whatsappMessageId || "—"}
                    </td>
                    <td className="px-4 sm:px-0 py-3">
                      <button
                        onClick={() => resendMutation.mutate(log.id)}
                        disabled={resendMutation.isPending}
                        className="border border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {resendMutation.isPending ? "Sending..." : "Send now"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

interface MessageLog {
  id: string;
  scheduleId: string;
  waGroupId: string;
  status: 'pending' | 'sent' | 'failed';
  errorReason: string | null;
  whatsappMessageId: string | null;
  message: string;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

const statusStyles: Record<MessageLog['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  sent: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

export default function LogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['logs', page],
    queryFn: async () => {
      const res = await api.get(`/logs?page=${page}&limit=50`);
      return res.data as { items: MessageLog[]; total: number; page: number; limit: number };
    },
    refetchInterval: 10_000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Message Logs</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No logs yet. Logs appear when schedules fire.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Group
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Message
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Scheduled
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[log.status]}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.waGroupId}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{log.message}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDistanceToNow(new Date(log.scheduledAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 space-y-1">
                      {log.errorReason && <div className="text-red-500">{log.errorReason}</div>}
                      {log.whatsappMessageId && (
                        <div className="text-gray-400 font-mono text-xs">
                          {log.whatsappMessageId.substring(0, 12)}...
                        </div>
                      )}
                      {!log.errorReason && !log.whatsappMessageId && <span>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, data.total)} of {data.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={page === 1}
                  className="p-1 rounded text-gray-500 hover:text-gray-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded text-gray-500 hover:text-gray-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

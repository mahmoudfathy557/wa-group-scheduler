import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";

interface Group {
  id: string;
  groupJid: string;
  name: string;
  participantCount: number | null;
}

export function Groups() {
  const qc = useQueryClient();
  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await api.get<Group[]>("/groups")).data
  });
  const sync = useMutation({
    mutationFn: async () => (await api.post<Group[]>("/groups/sync")).data,
    onSuccess: () => {
      toast.success("Groups synced");
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message || "Sync failed — is WhatsApp connected?"
      )
  });

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 sm:p-6 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Groups
          </h2>
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition text-center text-sm sm:text-base"
          >
            {sync.isPending ? "Syncing…" : "Sync from WhatsApp"}
          </button>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <p className="text-gray-500">Loading groups…</p>
          </div>
        ) : !groups || groups.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No groups yet — connect WhatsApp and sync groups.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-gray-50 text-left border-b border-gray-200">
                <tr>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden sm:table-cell">
                    Participants
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden md:table-cell">
                    JID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {groups.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-0 py-3 font-medium text-gray-900">
                      {g.name}
                    </td>
                    <td className="px-4 sm:px-0 py-3 text-gray-600 hidden sm:table-cell">
                      {g.participantCount ?? "—"}
                    </td>
                    <td className="px-4 sm:px-0 py-3 font-mono text-xs text-gray-500 hidden md:table-cell break-all">
                      {g.groupJid}
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

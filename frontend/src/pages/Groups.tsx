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
    <div className="bg-white p-6 rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Groups</h2>
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {sync.isPending ? "Syncing…" : "Sync from WhatsApp"}
        </button>
      </div>
      {isLoading ? (
        <p>Loading…</p>
      ) : !groups || groups.length === 0 ? (
        <p className="text-gray-600">
          No groups yet — connect WhatsApp and click Sync.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left border-b">
            <tr>
              <th className="py-2">Name</th>
              <th>Participants</th>
              <th>JID</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="border-b">
                <td className="py-2">{g.name}</td>
                <td>{g.participantCount ?? "—"}</td>
                <td className="font-mono text-xs text-gray-500">
                  {g.groupJid}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

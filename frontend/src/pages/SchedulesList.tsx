import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api";

interface Schedule {
  id: string;
  messageText: string;
  cronExpression: string;
  timezone: string;
  status: "active" | "paused";
  nextRunAt: string | null;
  groupLinks: { group: { id: string; name: string } }[];
}

function formatInTimezone(isoDate: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    timeZoneName: "short"
  }).format(new Date(isoDate));
}

export function SchedulesList() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => (await api.get<Schedule[]>("/schedules")).data
  });

  const toggle = useMutation({
    mutationFn: async (s: Schedule) => {
      const action = s.status === "active" ? "pause" : "resume";
      await api.post(`/schedules/${s.id}/${action}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] })
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/schedules/${id}`);
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["schedules"] });
    }
  });

  return (
    <div className="bg-white p-6 rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Schedules</h2>
        <Link
          to="/schedules/new"
          className="bg-emerald-600 text-white px-4 py-2 rounded"
        >
          New schedule
        </Link>
      </div>
      {isLoading ? (
        <p>Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="text-gray-600">No schedules yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left border-b">
            <tr>
              <th className="py-2">Message</th>
              <th>Cron</th>
              <th>Timezone</th>
              <th>Groups</th>
              <th>Next run</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="border-b align-top">
                <td className="py-2 max-w-sm truncate">{s.messageText}</td>
                <td className="font-mono text-xs">{s.cronExpression}</td>
                <td>{s.timezone}</td>
                <td>{s.groupLinks.length}</td>
                <td>
                  {s.nextRunAt
                    ? formatInTimezone(s.nextRunAt, s.timezone)
                    : "—"}
                </td>
                <td>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="text-right space-x-2">
                  <button
                    onClick={() => toggle.mutate(s)}
                    className="text-emerald-700"
                  >
                    {s.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <Link
                    to={`/schedules/${s.id}/edit`}
                    className="text-blue-700"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => confirm("Delete?") && remove.mutate(s.id)}
                    className="text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

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
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 sm:p-6 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Schedules
          </h2>
          <Link
            to="/schedules/new"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg transition text-center text-sm sm:text-base"
          >
            + New schedule
          </Link>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <p className="text-gray-500">Loading schedules…</p>
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No schedules yet. Create your first one!
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-gray-50 text-left border-b border-gray-200">
                <tr>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700">
                    Message
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden md:table-cell">
                    Cron
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden lg:table-cell">
                    Timezone
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden sm:table-cell">
                    Groups
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 hidden lg:table-cell">
                    Next run
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-4 sm:px-0 py-3 font-semibold text-gray-700 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 sm:px-0 py-3">
                      <p className="text-gray-900 font-medium max-w-xs sm:max-w-sm truncate">
                        {s.messageText}
                      </p>
                      <div className="md:hidden text-xs text-gray-500 mt-1">
                        {s.cronExpression}
                      </div>
                    </td>
                    <td className="px-4 sm:px-0 py-3 font-mono text-xs text-gray-600 hidden md:table-cell">
                      {s.cronExpression}
                    </td>
                    <td className="px-4 sm:px-0 py-3 text-gray-600 hidden lg:table-cell">
                      {s.timezone}
                    </td>
                    <td className="px-4 sm:px-0 py-3 text-gray-600 hidden sm:table-cell">
                      {s.groupLinks.length}
                    </td>
                    <td className="px-4 sm:px-0 py-3 text-xs sm:text-sm text-gray-600 hidden lg:table-cell">
                      {s.nextRunAt
                        ? formatInTimezone(s.nextRunAt, s.timezone)
                        : "—"}
                    </td>
                    <td className="px-4 sm:px-0 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                          s.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-0 py-3 text-right">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 justify-end">
                        <button
                          onClick={() => toggle.mutate(s)}
                          className="text-emerald-600 hover:text-emerald-700 font-medium text-xs sm:text-sm"
                        >
                          {s.status === "active" ? "Pause" : "Resume"}
                        </button>
                        <Link
                          to={`/schedules/${s.id}/edit`}
                          className="text-blue-600 hover:text-blue-700 font-medium text-xs sm:text-sm"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() =>
                            confirm("Delete this schedule?") &&
                            remove.mutate(s.id)
                          }
                          className="text-red-600 hover:text-red-700 font-medium text-xs sm:text-sm"
                        >
                          Delete
                        </button>
                      </div>
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

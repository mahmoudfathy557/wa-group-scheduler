import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { SCHEDULES_LIST_UI_TEXT } from "../lib/constants";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/Table";

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
      toast.success(SCHEDULES_LIST_UI_TEXT.deleteSuccess);
      qc.invalidateQueries({ queryKey: ["schedules"] });
    }
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Schedules</CardTitle>
        <Link to="/schedules/new">
          <Button size="sm">{SCHEDULES_LIST_UI_TEXT.newSchedule}</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">
              {SCHEDULES_LIST_UI_TEXT.loading}
            </p>
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {SCHEDULES_LIST_UI_TEXT.empty}
          </p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead className="hidden md:table-cell">Cron</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Timezone
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">Groups</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Next run
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium max-w-xs sm:max-w-sm truncate">
                        {s.messageText}
                      </p>
                      <div className="md:hidden text-xs text-muted-foreground mt-1">
                        {s.cronExpression}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs hidden md:table-cell">
                      {s.cronExpression}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {s.timezone}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {s.groupLinks.length}
                    </TableCell>
                    <TableCell className="text-xs hidden lg:table-cell">
                      {s.nextRunAt
                        ? formatInTimezone(s.nextRunAt, s.timezone)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.status === "active" ? "default" : "secondary"
                        }
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 justify-end">
                        <Button
                          onClick={() => toggle.mutate(s)}
                          variant="ghost"
                          size="sm"
                        >
                          {s.status === "active"
                            ? SCHEDULES_LIST_UI_TEXT.pause
                            : SCHEDULES_LIST_UI_TEXT.resume}
                        </Button>
                        <Link to={`/schedules/${s.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            {SCHEDULES_LIST_UI_TEXT.edit}
                          </Button>
                        </Link>
                        <Button
                          onClick={() =>
                            confirm(SCHEDULES_LIST_UI_TEXT.deleteConfirm) &&
                            remove.mutate(s.id)
                          }
                          variant="destructive"
                          size="sm"
                        >
                          {SCHEDULES_LIST_UI_TEXT.delete}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

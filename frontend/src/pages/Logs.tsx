import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { LOGS_REFETCH_INTERVAL_MS, LOGS_UI_TEXT } from "../lib/constants";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
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
    refetchInterval: LOGS_REFETCH_INTERVAL_MS
  });

  const groupNameByJid = Object.fromEntries(
    (groups ?? []).map((group) => [group.groupJid, group.name])
  );

  const statusVariantMap: Record<
    string,
    "default" | "secondary" | "destructive"
  > = {
    sent: "default",
    failed: "destructive",
    pending: "secondary"
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Message logs</CardTitle>
            <CardDescription>Auto-pruned after 7 days</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:border-transparent transition flex-1 sm:flex-none bg-background"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              {LOGS_UI_TEXT.refresh}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">{LOGS_UI_TEXT.loading}</p>
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {LOGS_UI_TEXT.empty}
          </p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead className="hidden sm:table-cell">Group</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Next retry
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <p className="font-medium text-sm">
                        {new Date(l.createdAt).toLocaleString()}
                      </p>
                      <div className="sm:hidden text-xs text-muted-foreground mt-1 break-all">
                        {groupNameByJid[l.groupJid] || l.groupJid}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs hidden sm:table-cell break-all max-w-xs">
                      {groupNameByJid[l.groupJid] || l.groupJid}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariantMap[l.status]}>
                        {l.status}
                      </Badge>
                      {l.status !== "sent" ? (
                        <div className="lg:hidden text-xs text-muted-foreground mt-1">
                          Next:{" "}
                          {l.nextRetryAt
                            ? new Date(l.nextRetryAt).toLocaleString()
                            : "Unknown"}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs hidden lg:table-cell">
                      {l.status === "sent"
                        ? "—"
                        : l.nextRetryAt
                          ? new Date(l.nextRetryAt).toLocaleString()
                          : "Unknown"}
                    </TableCell>
                    <TableCell className="text-xs hidden md:table-cell break-all">
                      {l.errorReason || l.whatsappMessageId || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <div className="px-6 py-4 border-t">
        <Link to="/retry-center">
          <Button variant="outline" size="sm">
            {LOGS_UI_TEXT.openRetryCenter}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

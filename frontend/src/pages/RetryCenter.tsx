import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";
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

  const statusVariantMap: Record<
    string,
    "default" | "secondary" | "destructive"
  > = {
    failed: "destructive",
    pending: "secondary"
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Retry center</CardTitle>
            <CardDescription>
              Resend pending or failed messages from a dedicated action view.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              ↻ Refresh
            </Button>
            <Button
              onClick={() => clearLogsMutation.mutate()}
              disabled={clearLogsMutation.isPending}
              variant="outline"
              size="sm"
            >
              {clearLogsMutation.isPending ? "Clearing..." : "Clear from view"}
            </Button>
          </div>
        </div>
        {clearError ? (
          <p className="text-sm text-destructive mt-3">{clearError}</p>
        ) : null}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">Loading retry items…</p>
          </div>
        ) : actionableLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No pending or failed messages right now.
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
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionableLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <p className="font-medium text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                      <div className="sm:hidden text-xs text-muted-foreground mt-1 break-all">
                        {groupNameByJid[log.groupJid] || log.groupJid}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs hidden sm:table-cell break-all max-w-xs">
                      {groupNameByJid[log.groupJid] || log.groupJid}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariantMap[log.status]}>
                        {log.status}
                      </Badge>
                      <div className="lg:hidden text-xs text-muted-foreground mt-1">
                        Next:{" "}
                        {log.nextRetryAt
                          ? new Date(log.nextRetryAt).toLocaleString()
                          : "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs hidden lg:table-cell">
                      {log.nextRetryAt
                        ? new Date(log.nextRetryAt).toLocaleString()
                        : "Unknown"}
                    </TableCell>
                    <TableCell className="text-xs hidden md:table-cell break-all">
                      {log.errorReason || log.whatsappMessageId || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => resendMutation.mutate(log.id)}
                        disabled={resendMutation.isPending}
                        variant="outline"
                        size="sm"
                      >
                        {resendMutation.isPending ? "Sending..." : "Send now"}
                      </Button>
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/Table";

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Groups</CardTitle>
        <Button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          size="sm"
        >
          {sync.isPending ? "Syncing…" : "Sync from WhatsApp"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">Loading groups…</p>
          </div>
        ) : !groups || groups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No groups yet — connect WhatsApp and sync groups.
          </p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Participants
                  </TableHead>
                  <TableHead className="hidden md:table-cell">JID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {g.participantCount ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs break-all">
                      {g.groupJid}
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

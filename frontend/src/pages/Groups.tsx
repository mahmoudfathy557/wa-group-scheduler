import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { GROUPS_PAGE_SIZE, GROUPS_UI_TEXT } from "../lib/constants";
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await api.get<Group[]>("/groups")).data
  });
  const sync = useMutation({
    mutationFn: async () => (await api.post<Group[]>("/groups/sync")).data,
    onSuccess: () => {
      toast.success(GROUPS_UI_TEXT.syncSuccess);
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.message || GROUPS_UI_TEXT.syncFallbackError
      )
  });

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        g.groupJid.toLowerCase().includes(query)
    );
  }, [groups, search]);

  const totalGroups = filteredGroups.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / GROUPS_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedGroups = useMemo(() => {
    if (!filteredGroups) return [];
    const start = (page - 1) * GROUPS_PAGE_SIZE;
    return filteredGroups.slice(start, start + GROUPS_PAGE_SIZE);
  }, [filteredGroups, page]);

  const rangeStart = totalGroups === 0 ? 0 : (page - 1) * GROUPS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * GROUPS_PAGE_SIZE, totalGroups);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Groups</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {GROUPS_UI_TEXT.totalLabel}: {totalGroups}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={isLoading || totalGroups === 0 || page <= 1}
          >
            {GROUPS_UI_TEXT.prev}
          </Button>
          <span className="order-last w-full text-center text-xs text-muted-foreground sm:order-none sm:w-auto sm:min-w-24">
            {rangeStart}-{rangeEnd} / {totalGroups}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={isLoading || totalGroups === 0 || page >= totalPages}
          >
            {GROUPS_UI_TEXT.next}
          </Button>
          <Button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            size="sm"
          >
            {sync.isPending
              ? GROUPS_UI_TEXT.syncing
              : GROUPS_UI_TEXT.syncButton}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={GROUPS_UI_TEXT.searchPlaceholder}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:border-transparent transition bg-background"
          />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <p className="text-muted-foreground">{GROUPS_UI_TEXT.loading}</p>
          </div>
        ) : !groups || groups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {GROUPS_UI_TEXT.empty}
          </p>
        ) : filteredGroups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {GROUPS_UI_TEXT.emptyFiltered}
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
                {pagedGroups.map((g) => (
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

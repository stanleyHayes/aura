"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import type { AuditLog } from "@cbs/schemas";
import { Input } from "@cbs/ui/components/input";
import { Badge } from "@cbs/ui/components/badge";
import { Skeleton } from "@cbs/ui/components/skeleton";
import { formatDateTime } from "@cbs/ui/lib/datetime";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";

export function AuditClient() {
  const [entityType, setEntityType] = React.useState("");

  const query = useQuery({
    queryKey: qk.auditLogs({ entityType }),
    queryFn: async (): Promise<AuditLog[]> => {
      const page = unwrap(
        await api.GET("/api/v1/audit-logs", {
          params: {
            query: { limit: 200, entity_type: entityType || undefined },
          },
        }),
      );
      return page.data as AuditLog[];
    },
  });

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: "created_at",
      header: "When",
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
    {
      accessorKey: "actor_name",
      header: "Actor",
      cell: ({ row }) => row.original.actor_name ?? "system",
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => <Badge variant="secondary">{row.original.action}</Badge>,
    },
    {
      accessorKey: "entity_type",
      header: "Entity",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.entity_type}
          {row.original.entity_id ? `/${row.original.entity_id.slice(0, 8)}` : ""}
        </span>
      ),
    },
    {
      accessorKey: "ip_address",
      header: "IP",
      cell: ({ row }) => row.original.ip_address ?? "—",
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="An append-only record of every state change. Read-only."
      />

      <div className="mb-4 max-w-xs">
        <Input
          placeholder="Filter by entity type (e.g. booking)"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          aria-label="Filter by entity type"
        />
      </div>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : query.isError ? (
        <ProblemAlert error={query.error} />
      ) : (
        <DataTable columns={columns} data={query.data ?? []} caption="Audit log" />
      )}
    </>
  );
}

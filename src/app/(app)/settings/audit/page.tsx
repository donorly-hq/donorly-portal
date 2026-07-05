"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AuditLogEntry, PageResponse } from "@/lib/types";
import { Badge, Button, Card, PageHeader, Spinner } from "@/components/ui";

const PAGE_SIZE = 50;

function actionTone(action: string): "success" | "warning" | "danger" | "neutral" {
  if (action.includes("delete") || action.includes("remove") || action.includes("revoke")) return "danger";
  if (action.includes("create") || action.includes("add") || action.includes("import")) return "success";
  if (action.includes("update") || action.includes("merge") || action.includes("change")) return "warning";
  return "neutral";
}

export default function AuditLogPage() {
  const [pageData, setPageData] = useState<PageResponse<AuditLogEntry> | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<PageResponse<AuditLogEntry>>(`/audit-logs?page=${page}&size=${PAGE_SIZE}`)
      .then(setPageData)
      .catch((e) => setError(e.message));
  }, [page]);

  useEffect(load, [load]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!pageData) return <Spinner />;

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle="Who changed what, across your organization"
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/40">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {pageData.items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-black/40">
                  No audit activity yet.
                </td>
              </tr>
            ) : (
              pageData.items.map((entry) => (
                <tr key={entry.id} className="border-b border-black/5 hover:bg-black/[0.02]">
                  <td className="whitespace-nowrap px-4 py-3 text-black/60">
                    {dateFmt.format(new Date(entry.createdAt))}
                  </td>
                  <td className="px-4 py-3">
                    {entry.actorName ? (
                      <div>
                        <p className="font-medium">{entry.actorName}</p>
                        <p className="text-xs text-black/40">{entry.actorEmail}</p>
                      </div>
                    ) : (
                      <span className="text-black/40">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-black/60">
                    {entry.entityType ?? "—"}
                    {entry.entityId ? (
                      <span className="ml-1 text-xs text-black/30">
                        {entry.entityId.slice(0, 8)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {pageData.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-black/50">
            Page {pageData.page + 1} of {pageData.totalPages} · {pageData.totalItems} entries
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pageData.totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

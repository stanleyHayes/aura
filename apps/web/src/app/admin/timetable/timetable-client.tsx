"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  ListChecks,
  TimerReset,
  TriangleAlert,
  Upload,
} from "lucide-react";
import {
  type Semester,
  type TimetableImport,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cbs/ui/components/card";
import { Input } from "@cbs/ui/components/input";
import { Badge } from "@cbs/ui/components/badge";
import { Skeleton } from "@cbs/ui/components/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@cbs/ui/components/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cbs/ui/components/select";
import { useToast } from "@cbs/ui/components/toast";
import { Combobox } from "@/components/combobox";
import { CSRF } from "@cbs/api-client";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/forms/field";
import { MetricCard, type MetricTone } from "@/components/metric-card";

type ImportErrorRow = NonNullable<TimetableImport["error_report"]>[number];

function readCsrf(): string | undefined {
  const m = document.cookie.match(/(?:^|; )(?:cbs_csrf|cbs-csrf)=([^;]*)/);
  return m ? decodeURIComponent(m[1]!) : undefined;
}

const STATUS_VARIANT: Record<TimetableImport["status"], "approved" | "pending" | "rejected" | "secondary"> =
  {
    COMPLETED: "approved",
    PARTIALLY_COMPLETED: "pending",
    PROCESSING: "secondary",
    PENDING: "secondary",
    FAILED: "rejected",
  };

const STATUS_LABEL: Record<TimetableImport["status"], string> = {
  COMPLETED: "Completed",
  PARTIALLY_COMPLETED: "Partially completed",
  PROCESSING: "Processing",
  PENDING: "Queued",
  FAILED: "Failed",
};

const STATUS_COPY: Record<TimetableImport["status"], string> = {
  COMPLETED: "The timetable is ready. Imported rows are now available to the booking engine.",
  PARTIALLY_COMPLETED: "Some rows need attention. Review the row report before uploading another file.",
  PROCESSING: "AURA is parsing the file and validating rooms, days, and time ranges.",
  PENDING: "The import has been received and is waiting to be processed.",
  FAILED: "The import could not complete. Check the report or try a corrected file.",
};

function ImportMetric({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone?: Extract<MetricTone, "neutral" | "success" | "warning">;
}) {
  return (
    <MetricCard
      label={label}
      value={value}
      subtext={hint}
      icon={icon}
      tone={tone}
      asDefinition
    />
  );
}

function ImportChecklist() {
  const steps = [
    { icon: ListChecks, label: "Pick semester", detail: "Target the term this file belongs to." },
    { icon: FileSpreadsheet, label: "Attach file", detail: "Use .xlsx or .csv with the expected columns." },
    { icon: TimerReset, label: "Watch progress", detail: "Imported rows and row errors appear here." },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map(({ icon: Icon, label, detail }, index) => (
        <div
          key={label}
          className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_32%,transparent)] p-4"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-card)] text-[var(--color-maroon)] shadow-sm">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Step {index + 1}
            </span>
          </div>
          <p className="mt-3 font-semibold text-[var(--color-foreground)]">
            {label}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted-foreground)]">
            {detail}
          </p>
        </div>
      ))}
    </div>
  );
}

export function TimetableClient() {
  const { toast } = useToast();
  const [semesterId, setSemesterId] = React.useState("");
  const [mode, setMode] = React.useState<"append" | "replace">("append");
  const [file, setFile] = React.useState<File | null>(null);
  const [importId, setImportId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const semesters = useQuery({
    queryKey: qk.semesters,
    queryFn: async (): Promise<Semester[]> => {
      const page = unwrap(
        await api.GET("/api/v1/semesters", {
          params: { query: { limit: 100 } },
        }),
      );
      return page.data as Semester[];
    },
  });

  // Poll the import status until it reaches a terminal state (§7.5).
  const importStatus = useQuery({
    queryKey: importId ? qk.timetableImport(importId) : ["timetable-import", "none"],
    enabled: importId !== null,
    refetchInterval: (q) => {
      const data = q.state.data as TimetableImport | undefined;
      if (!data) return 1500;
      const terminal = ["COMPLETED", "PARTIALLY_COMPLETED", "FAILED"];
      return terminal.includes(data.status) ? false : 1500;
    },
    queryFn: async (): Promise<TimetableImport> =>
      unwrap(
        await api.GET("/api/v1/timetable/imports/{id}", {
          params: { path: { id: importId! } },
        }),
      ),
  });

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!semesterId || !file) return;
    setUploading(true);
    try {
      // Multipart upload — use raw fetch (typed client is JSON-only).
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const csrf = readCsrf();
      const res = await fetch(
        `/api/v1/semesters/${semesterId}/timetable/import`,
        {
          method: "POST",
          credentials: "include",
          headers: csrf ? { [CSRF.HEADER]: csrf } : undefined,
          body: fd,
        },
      );
      if (!res.ok) {
        const problem = await res.json().catch(() => ({
          title: "Upload failed",
          status: res.status,
          code: "UPLOAD_FAILED",
        }));
        throw Object.assign(new Error(problem.title), problem);
      }
      const created = (await res.json()) as TimetableImport;
      setImportId(created.id);
      toast({ variant: "success", title: "Upload received", description: "Processing…" });
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  }

  const status = importStatus.data;
  const progressPct =
    status && status.total_rows > 0
      ? Math.round(
          ((status.imported_rows + status.error_rows) / status.total_rows) * 100,
        )
      : status?.status === "COMPLETED"
        ? 100
        : 0;
  const errorColumns = React.useMemo<ColumnDef<ImportErrorRow>[]>(
    () => [
      {
        accessorKey: "row",
        header: "Row",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.row}</span>
        ),
      },
      {
        accessorKey: "field",
        header: "Field",
        cell: ({ row }) => row.original.field ?? "—",
      },
      {
        accessorKey: "message",
        header: "Message",
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        icon={FileSpreadsheet}
        title="Timetable import"
        description="Upload the semester schedule from Excel or CSV. Replacing a timetable never touches existing bookings."
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onUpload} className="flex flex-col gap-4" noValidate>
              {error ? <ProblemAlert error={error} /> : null}

              <Field id="tt-semester" label="Semester" required>
                {(p) =>
                  semesters.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Combobox
                      id={p.id}
                      value={semesterId}
                      onValueChange={setSemesterId}
                      placeholder="Choose a semester"
                      searchPlaceholder="Search semesters…"
                      emptyText="No semesters found."
                      options={(semesters.data ?? []).map((s) => ({
                        value: s.id,
                        label: s.name,
                        description: s.status.toLowerCase(),
                      }))}
                    />
                  )
                }
              </Field>

              <Field id="tt-mode" label="Mode" description="Replace clears existing lecture events for the semester first.">
                {(p) => (
                  <Select value={mode} onValueChange={(v) => setMode(v as "append" | "replace")}>
                    <SelectTrigger id={p.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="append">Append</SelectItem>
                      <SelectItem value="replace">Replace</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field id="tt-file" label="File (.xlsx or .csv)" required>
                {(p) => (
                  <Input
                    {...p}
                    type="file"
                    accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                )}
              </Field>

              <Button type="submit" disabled={uploading || !file || !semesterId}>
                <Upload className="size-4" />
                {uploading ? "Uploading…" : "Upload timetable"}
              </Button>

              <p className="text-xs text-[var(--color-muted-foreground)]">
                Expected columns: Course Code, Course Title, Lecturer, Room, Day,
                Start Time, End Time.
              </p>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-maroon-tint)_38%,var(--color-card))]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-card)] text-[var(--color-maroon)] shadow-sm">
                  <ClipboardList className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle>Import progress</CardTitle>
                  <CardDescription>
                    Track validation, imported rows, and row-level issues.
                  </CardDescription>
                </div>
              </div>
              <Badge variant={status ? STATUS_VARIANT[status.status] : "secondary"}>
                {status ? STATUS_LABEL[status.status] : "No import"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            {!importId ? (
              <div className="space-y-5">
                <EmptyState
                  icon={FileSpreadsheet}
                  title="Ready for a timetable file"
                  description="Choose a semester, attach the timetable, then upload it to see live row progress and validation results here."
                  actions={
                    <Button asChild variant="outline">
                      <label htmlFor="tt-file" className="cursor-pointer">
                        <Upload className="size-4" aria-hidden="true" />
                        Select timetable file
                      </label>
                    </Button>
                  }
                  className="py-12"
                />
                <ImportChecklist />
              </div>
            ) : !status ? (
              <div className="space-y-4" aria-busy="true" aria-live="polite">
                <Skeleton className="h-24 w-full" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="flex flex-col gap-5" aria-live="polite">
                <div className="rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_28%,transparent)] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-card)] text-[var(--color-maroon)] shadow-sm">
                        {status.status === "FAILED" ? (
                          <TriangleAlert className="size-5" aria-hidden="true" />
                        ) : status.status === "COMPLETED" ? (
                          <CheckCircle2 className="size-5" aria-hidden="true" />
                        ) : (
                          <FileCheck2 className="size-5" aria-hidden="true" />
                        )}
                      </span>
                      <div>
                        <p className="text-lg font-semibold text-[var(--color-foreground)]">
                          {STATUS_LABEL[status.status]}
                        </p>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--color-muted-foreground)]">
                          {STATUS_COPY[status.status]}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-[var(--color-muted-foreground)]">
                      {progressPct}% complete
                    </span>
                  </div>

                  <div
                    className="mt-5 h-3 w-full overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--color-muted)_75%,transparent)]"
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Import progress"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--color-maroon)] transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <dl className="grid gap-3 sm:grid-cols-3">
                  <ImportMetric
                    label="Total rows"
                    value={status.total_rows}
                    hint="Rows detected in the uploaded file."
                    icon={ClipboardList}
                  />
                  <ImportMetric
                    label="Imported"
                    value={status.imported_rows}
                    hint="Rows accepted into the semester timetable."
                    icon={FileCheck2}
                    tone="success"
                  />
                  <ImportMetric
                    label="Needs review"
                    value={status.error_rows}
                    hint="Rows skipped because validation failed."
                    icon={TriangleAlert}
                    tone={status.error_rows > 0 ? "warning" : "neutral"}
                  />
                </dl>

                {status.error_rows > 0 ? (
                  <Alert variant="warning">
                    <AlertTitle>
                      {status.error_rows} row{status.error_rows === 1 ? "" : "s"} could
                      not be imported
                    </AlertTitle>
                    <AlertDescription>
                      The rest were imported successfully. See the report below.
                    </AlertDescription>
                  </Alert>
                ) : status.status === "COMPLETED" ? (
                  <Alert variant="success">
                    <AlertTitle>Import complete</AlertTitle>
                    <AlertDescription>
                      All {status.imported_rows} rows were imported.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {status.error_report && status.error_report.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-base font-semibold text-[var(--color-foreground)]">
                        Row error report
                      </h4>
                      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                        Fix these rows in the source file, then upload again.
                      </p>
                    </div>
                    <DataTable
                      columns={errorColumns}
                      data={status.error_report}
                      caption="Timetable import errors"
                      initialPageSize={5}
                      pageSizeOptions={[5, 10, 25]}
                      emptyIcon={CheckCircle2}
                      emptyTitle="No row errors"
                      emptyDescription="All parsed rows passed validation."
                    />
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

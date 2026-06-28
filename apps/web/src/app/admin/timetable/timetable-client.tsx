"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import {
  type Semester,
  type TimetableImport,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@cbs/ui/components/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cbs/ui/components/table";
import { useToast } from "@cbs/ui/components/toast";
import { CSRF } from "@cbs/api-client";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { PageHeader } from "@/components/page-header";
import { ProblemAlert } from "@/components/problem-alert";
import { Field } from "@/components/forms/field";

function readCsrf(): string | undefined {
  const m = document.cookie.match(/(?:^|; )cbs-csrf=([^;]*)/);
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

  return (
    <>
      <PageHeader
        title="Timetable import"
        description="Upload the semester schedule from Excel or CSV. Replacing a timetable never touches existing bookings."
      />

      <div className="grid gap-6 lg:grid-cols-2">
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
                    <Select value={semesterId} onValueChange={setSemesterId}>
                      <SelectTrigger id={p.id}>
                        <SelectValue placeholder="Choose a semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {(semesters.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.status.toLowerCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

        <Card>
          <CardHeader>
            <CardTitle>Import progress</CardTitle>
          </CardHeader>
          <CardContent>
            {!importId ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
                <FileSpreadsheet className="size-8" aria-hidden="true" />
                Upload a file to see progress and any row errors here.
              </div>
            ) : !status ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <Badge variant={STATUS_VARIANT[status.status]}>
                    {status.status.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                  <span className="text-sm tabular-nums text-[var(--color-muted-foreground)]">
                    {status.imported_rows}/{status.total_rows} rows
                  </span>
                </div>

                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Import progress"
                >
                  <div
                    className="h-full bg-[var(--color-ink-600)] transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

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
                  <div className="max-h-64 overflow-auto rounded-lg border border-[var(--color-border)]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {status.error_report.map((er, i) => (
                          <TableRow key={`${er.row}-${i}`}>
                            <TableCell className="tabular-nums">{er.row}</TableCell>
                            <TableCell>{er.field ?? "—"}</TableCell>
                            <TableCell>{er.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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

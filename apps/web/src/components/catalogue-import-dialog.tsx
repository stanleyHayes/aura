"use client";

import * as React from "react";
import { FileSpreadsheet, Upload, XCircle } from "lucide-react";
import {
  RoomStatus,
  RoomType,
  type Building,
  type Equipment,
  type Room,
} from "@cbs/schemas";
import { Button } from "@cbs/ui/components/button";
import { Input } from "@cbs/ui/components/input";
import { Badge } from "@cbs/ui/components/badge";
import { Alert, AlertDescription, AlertTitle } from "@cbs/ui/components/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cbs/ui/components/dialog";
import { useToast } from "@cbs/ui/components/toast";
import { api, unwrap } from "@/lib/api/client";
import { ProblemAlert } from "@/components/problem-alert";

type ImportKind = "buildings" | "equipment" | "rooms";
type Row = Record<string, string>;
type RowError = { row: number; message: string };

const ROOM_TYPE_VALUES = new Set<string>(RoomType.options);
const ROOM_STATUS_VALUES = new Set<string>(RoomStatus.options);

function normaliseKey(key: string) {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normaliseEnum(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function value(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const found = row[normaliseKey(key)];
    if (found !== undefined && found.trim() !== "") return found.trim();
  }
  return "";
}

function parseDelimited(text: string, delimiter: "," | "\t"): Row[] {
  const rows: string[][] = [];
  let current = "";
  let record: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      record.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      record.push(current);
      if (record.some((cell) => cell.trim() !== "")) rows.push(record);
      record = [];
      current = "";
    } else {
      current += char;
    }
  }
  record.push(current);
  if (record.some((cell) => cell.trim() !== "")) rows.push(record);

  const headers = (rows.shift() ?? []).map(normaliseKey);
  return rows.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
  );
}

async function parseImportFile(file: File): Promise<Row[]> {
  const text = await file.text();
  const name = file.name.toLowerCase();
  if (name.endsWith(".json") || file.type === "application/json") {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { data?: unknown }).data)
        ? (parsed as { data: unknown[] }).data
        : null;
    if (!rows) throw new Error("JSON imports must be an array or an object with a data array.");
    return rows.map((entry) =>
      Object.fromEntries(
        Object.entries(entry as Record<string, unknown>).map(([key, entryValue]) => [
          normaliseKey(key),
          entryValue == null ? "" : String(entryValue),
        ]),
      ),
    );
  }
  if (name.endsWith(".tsv")) return parseDelimited(text, "\t");
  return parseDelimited(text, ",");
}

function toBuildingPayload(row: Row) {
  const code = value(row, "code", "building_code");
  const name = value(row, "name", "building_name");
  if (!code) throw new Error("Building code is required.");
  if (!name) throw new Error("Building name is required.");
  return {
    code,
    name,
    campus: value(row, "campus") || undefined,
  };
}

function toEquipmentPayload(row: Row) {
  const code = value(row, "code", "equipment_code");
  const name = value(row, "name", "equipment_name");
  if (!code) throw new Error("Equipment code is required.");
  if (!name) throw new Error("Equipment name is required.");
  return { code, name };
}

function buildingLookup(buildings: Building[]) {
  const out = new Map<string, string>();
  for (const building of buildings) {
    out.set(building.id.toLowerCase(), building.id);
    out.set(building.code.toLowerCase(), building.id);
    out.set(building.name.toLowerCase(), building.id);
  }
  return out;
}

function toRoomPayload(row: Row, buildings: Building[]) {
  const lookup = buildingLookup(buildings);
  const buildingLabel = value(row, "building_id", "building_code", "building", "building_name");
  const buildingID = lookup.get(buildingLabel.toLowerCase());
  const roomType = normaliseEnum(value(row, "room_type", "type") || "LECTURE_HALL");
  const status = normaliseEnum(value(row, "status") || "ACTIVE");
  const capacity = Number.parseInt(value(row, "capacity", "seats") || "0", 10);
  const roomCode = value(row, "room_code", "code");
  const name = value(row, "name", "room_name");

  if (!roomCode) throw new Error("Room code is required.");
  if (!name) throw new Error("Room name is required.");
  if (!buildingID) throw new Error("Building must match an existing building code, name, or id.");
  if (!Number.isFinite(capacity) || capacity < 1) throw new Error("Capacity must be at least 1.");
  if (!ROOM_TYPE_VALUES.has(roomType)) {
    throw new Error(`Room type must be one of ${RoomType.options.join(", ")}.`);
  }
  if (!ROOM_STATUS_VALUES.has(status)) {
    throw new Error(`Status must be one of ${RoomStatus.options.join(", ")}.`);
  }

  return {
    room_code: roomCode,
    name,
    building_id: buildingID,
    capacity,
    room_type: roomType as RoomType,
    status,
  };
}

export function CatalogueImportDialog({
  kind,
  open,
  onOpenChange,
  buildings = [],
  equipment = [],
  rooms = [],
  onImported,
}: {
  kind: ImportKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildings?: Building[];
  equipment?: Equipment[];
  rooms?: Room[];
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [summary, setSummary] = React.useState<{
    total: number;
    imported: number;
    errors: RowError[];
  } | null>(null);

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSummary(null);
    const rowErrors: RowError[] = [];
    let imported = 0;
    try {
      const rows = await parseImportFile(file);
      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        try {
          if (kind === "buildings") {
            const body = toBuildingPayload(row);
            const existing = buildings.find(
              (building) => building.code.toLowerCase() === body.code.toLowerCase(),
            );
            if (existing) {
              unwrap(
                await api.PATCH("/api/v1/buildings/{id}", {
                  params: { path: { id: existing.id } },
                  body: body as never,
                }),
              );
            } else {
              unwrap(await api.POST("/api/v1/buildings", { body: body as never }));
            }
          } else if (kind === "equipment") {
            const body = toEquipmentPayload(row);
            const existing = equipment.find(
              (item) => item.code.toLowerCase() === body.code.toLowerCase(),
            );
            if (existing) {
              unwrap(
                await api.PATCH("/api/v1/equipment/{id}", {
                  params: { path: { id: existing.id } },
                  body: body as never,
                }),
              );
            } else {
              unwrap(await api.POST("/api/v1/equipment", { body: body as never }));
            }
          } else {
            const body = toRoomPayload(row, buildings);
            const existing = rooms.find(
              (room) => room.room_code.toLowerCase() === body.room_code.toLowerCase(),
            );
            if (existing) {
              unwrap(
                await api.PATCH("/api/v1/rooms/{id}", {
                  params: { path: { id: existing.id } },
                  body: body as never,
                }),
              );
            } else {
              unwrap(await api.POST("/api/v1/rooms", { body: body as never }));
            }
          }
          imported += 1;
          setSummary({ total: rows.length, imported, errors: [...rowErrors] });
        } catch (err) {
          rowErrors.push({
            row: rowNumber,
            message: err instanceof Error ? err.message : "Row could not be imported.",
          });
          setSummary({ total: rows.length, imported, errors: [...rowErrors] });
        }
      }
      onImported();
      toast({
        variant: imported > 0 ? "success" : "destructive",
        title: imported > 0 ? "Import complete" : "Import failed",
        description: `${imported} of ${rows.length} rows imported.`,
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function reset(openNext: boolean) {
    onOpenChange(openNext);
    if (!openNext) {
      setFile(null);
      setError(null);
      setSummary(null);
      setBusy(false);
    }
  }

  const title =
    kind === "buildings"
      ? "Import buildings"
      : kind === "equipment"
        ? "Import equipment"
        : "Import rooms";
  const required =
    kind === "buildings"
      ? "code, name, campus"
      : kind === "equipment"
        ? "code, name"
      : "room_code, name, building_code, capacity, room_type, status";

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            CSV, TSV or JSON. Expected columns: {required}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <ProblemAlert error={error} /> : null}
          <div className="rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-muted)_24%,transparent)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--color-card)] text-[var(--color-maroon)]">
                  <FileSpreadsheet className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--color-foreground)]">
                    {file ? file.name : "Choose import file"}
                  </p>
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    {file ? `${Math.ceil(file.size / 1024)} KB` : ".csv, .tsv, .json"}
                  </p>
                </div>
              </div>
              <Input
                type="file"
                accept=".csv,.tsv,.json,text/csv,text/tab-separated-values,application/json"
                className="max-w-xs"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {summary ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={summary.imported > 0 ? "approved" : "secondary"}>
                  {summary.imported} imported
                </Badge>
                <Badge variant={summary.errors.length > 0 ? "rejected" : "secondary"}>
                  {summary.errors.length} errors
                </Badge>
                <span className="text-sm text-[var(--color-muted-foreground)]">
                  {summary.total} rows read
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
                  style={{
                    width: `${summary.total > 0 ? Math.round(((summary.imported + summary.errors.length) / summary.total) * 100) : 0}%`,
                  }}
                />
              </div>
              {summary.errors.length > 0 ? (
                <Alert variant="destructive">
                  <XCircle />
                  <AlertTitle>Rows that need attention</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 max-h-36 space-y-1 overflow-auto">
                      {summary.errors.slice(0, 8).map((item) => (
                        <li key={`${item.row}-${item.message}`}>
                          Row {item.row}: {item.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => reset(false)}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => void runImport()}
            disabled={!file || busy}
            loading={busy}
            loadingLabel="Importing"
          >
            <Upload className="size-4" /> Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

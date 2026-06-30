"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  TableProperties,
} from "lucide-react";
import { Button } from "@cbs/ui/components/button";
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
import { cn } from "@cbs/ui/lib/cn";
import { EmptyState } from "@/components/empty-state";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Generic accessible table built on TanStack Table v8 (§10.1). */
export function DataTable<TData, TValue>({
  columns,
  data,
  caption,
  emptyTitle,
  emptyDescription,
  emptyIcon: EmptyIcon = TableProperties,
  emptyActions,
  initialPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  caption?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyActions?: React.ReactNode;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: initialPageSize,
  }));
  const sizeOptions = React.useMemo(
    () =>
      Array.from(new Set([...pageSizeOptions, initialPageSize]))
        .filter((size) => size > 0)
        .sort((a, b) => a - b),
    [initialPageSize, pageSizeOptions],
  );
  const table = useReactTable({
    data,
    columns,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const pageRows = table.getRowModel().rows;
  const totalRows = table.getPrePaginationRowModel().rows.length;
  const hasRows = totalRows > 0;
  const pageCount = table.getPageCount();
  const firstRow = hasRows ? pagination.pageIndex * pagination.pageSize + 1 : 0;
  const lastRow = hasRows
    ? Math.min(firstRow + pageRows.length - 1, totalRows)
    : 0;
  const defaultEmptyTitle =
    emptyTitle ?? (caption ? `No ${caption.toLowerCase()} yet` : "No records yet");
  const defaultEmptyDescription =
    emptyDescription ??
    "There is nothing to show for this table yet. Refresh the page or adjust the surrounding filters.";

  React.useEffect(() => {
    setPagination((current) => {
      const maxPageIndex = Math.max(
        0,
        Math.ceil(totalRows / current.pageSize) - 1,
      );
      return current.pageIndex > maxPageIndex
        ? { ...current, pageIndex: maxPageIndex }
        : current;
    });
  }, [pagination.pageSize, totalRows]);

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--color-card)]">
      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm hover:text-[var(--color-foreground)]",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
                        )}
                        aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {!hasRows ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="p-0"
              >
                <EmptyState
                  icon={EmptyIcon}
                  title={defaultEmptyTitle}
                  description={defaultEmptyDescription}
                  actions={
                    emptyActions ?? (
                      <Button
                        type="button"
                        onClick={() => window.location.reload()}
                      >
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Refresh
                      </Button>
                    )
                  }
                  variant="table"
                  className="px-4 py-16"
                />
              </TableCell>
            </TableRow>
          ) : (
            pageRows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {hasRows ? (
        <div className="flex flex-col gap-3 border-x border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Showing{" "}
            <span className="font-medium tabular-nums text-[var(--color-foreground)]">
              {firstRow}
            </span>
            {" - "}
            <span className="font-medium tabular-nums text-[var(--color-foreground)]">
              {lastRow}
            </span>{" "}
            of{" "}
            <span className="font-medium tabular-nums text-[var(--color-foreground)]">
              {totalRows}
            </span>
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <span>Rows per page</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger
                  aria-label="Rows per page"
                  className="h-9 w-[5rem] bg-[var(--color-card)]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {sizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <span className="min-w-24 text-center text-sm text-[var(--color-muted-foreground)]">
                Page{" "}
                <span className="font-medium tabular-nums text-[var(--color-foreground)]">
                  {pagination.pageIndex + 1}
                </span>{" "}
                of{" "}
                <span className="font-medium tabular-nums text-[var(--color-foreground)]">
                  {pageCount}
                </span>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to first page"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={() => table.setPageIndex(pageCount - 1)}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to last page"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

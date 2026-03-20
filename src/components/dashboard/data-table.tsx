"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "./pagination";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  limit: number;
  offset: number;
  sort?: string;
  order?: "asc" | "desc";
  onSortChange?: (sort: string, order: "asc" | "desc") => void;
  onPageChange?: (offset: number) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  total,
  limit,
  offset,
  sort,
  order,
  onSortChange,
  onPageChange,
  isLoading,
  emptyMessage = "No data found",
  onRowClick,
}: DataTableProps<T>) {
  const handleSort = (key: string) => {
    if (!onSortChange) return;
    const newOrder = sort === key && order === "desc" ? "asc" : "desc";
    onSortChange(key, newOrder);
  };

  const renderSortIcon = (key: string) => {
    if (sort !== key) return <ChevronsUpDown className="size-3.5 opacity-30" />;
    return order === "asc" ? (
      <ChevronUp className="size-3.5 text-soft-violet" />
    ) : (
      <ChevronDown className="size-3.5 text-soft-violet" />
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-DEFAULT/20 bg-midnight-plum">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-DEFAULT/20 hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "text-dusty-lavender/70",
                    col.sortable && "cursor-pointer select-none",
                    col.className
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                  aria-sort={
                    col.sortable && sort === col.key
                      ? order === "asc" ? "ascending" : "descending"
                      : col.sortable ? "none" : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && renderSortIcon(col.key)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: Math.min(limit, 10) }).map((_, i) => (
                  <TableRow key={i} className="border-slate-DEFAULT/10">
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <Skeleton className="h-5 w-full bg-deep-iris/20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data.length === 0
                ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-dusty-lavender/50"
                      >
                        {emptyMessage}
                      </TableCell>
                    </TableRow>
                  )
                : data.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className={cn(
                        "border-slate-DEFAULT/10 transition-colors hover:bg-deep-iris/10",
                        onRowClick && "cursor-pointer"
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((col) => (
                        <TableCell key={col.key} className={col.className}>
                          {col.render
                            ? col.render(row)
                            : String(row[col.key] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
          </TableBody>
        </Table>
      </div>
      {total > limit && onPageChange && (
        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

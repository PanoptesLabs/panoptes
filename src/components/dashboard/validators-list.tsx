"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useValidators } from "@/hooks/use-validators";
import { DataTable, type Column } from "./data-table";
import { StatusBadge } from "./status-badge";
import { SearchInput } from "./search-input";
import { FilterSelect } from "./filter-select";
import { ErrorState } from "./error-state";
import { formatTokensShort, formatCommission } from "@/lib/formatters";
import { timeAgo } from "@/lib/time";
import { getValidatorStatusInfo } from "@/lib/status";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { ScoreBadge } from "./score-badge";
import { HelpTooltip } from "./help-tooltip";
import { helpContent } from "@/lib/help-content";
import { ValidatorCompare } from "./validator-compare";
import type { ValidatorListItem } from "@/types";

const STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Bonded", value: "BOND_STATUS_BONDED" },
  { label: "Unbonding", value: "BOND_STATUS_UNBONDING" },
  { label: "Unbonded", value: "BOND_STATUS_UNBONDED" },
];

export function ValidatorsList() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("tokens");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const limit = 50;

  const { data, error, isLoading, mutate } = useValidators({
    status: status || undefined,
    sort,
    order,
    limit,
    offset,
    search: search || undefined,
  });

  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    setOffset(0);
  }, []);

  const handleSortChange = (newSort: string, newOrder: "asc" | "desc") => {
    setSort(newSort);
    setOrder(newOrder);
    setOffset(0);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setOffset(0);
  };

  const columns: Column<ValidatorListItem>[] = [
    {
      key: "moniker",
      header: "Validator",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-deep-iris/30 text-xs font-bold text-soft-violet">
            {row.moniker.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-mist">{row.moniker}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const info = getValidatorStatusInfo(row.status);
        return (
          <StatusBadge
            status={info.label.toLowerCase() as "bonded" | "unbonding" | "unbonded"}
          />
        );
      },
    },
    {
      key: "tokens",
      header: "Staked",
      sortable: true,
      className: "text-right font-mono",
      render: (row) => (
        <span className="text-mist">{formatTokensShort(row.tokens)}</span>
      ),
    },
    {
      key: "commission",
      header: (
        <span className="flex items-center gap-1">
          Commission
          <HelpTooltip content={helpContent.validators.fields.commission} side="bottom" />
        </span>
      ),
      sortable: true,
      className: "text-right",
      render: (row) => (
        <span className="text-dusty-lavender/70">
          {formatCommission(row.commission)}
        </span>
      ),
    },
    {
      key: "score" as keyof ValidatorListItem,
      header: (
        <span className="flex items-center gap-1">
          Score
          <HelpTooltip content={helpContent.validators.fields.score} side="bottom" />
        </span>
      ),
      className: "text-center",
      render: (row: ValidatorListItem) => (
        <ScoreBadge score={row.score?.score ?? null} />
      ),
    },
    {
      key: "jailed",
      header: (
        <span className="flex items-center gap-1">
          Jailed
          <HelpTooltip content={helpContent.validators.fields.jailed} side="bottom" />
        </span>
      ),
      render: (row) =>
        row.jailed ? (
          <ShieldAlert className="size-4 text-rose-DEFAULT" />
        ) : (
          <ShieldCheck className="size-4 text-teal-DEFAULT/50" />
        ),
    },
    {
      key: "lastUpdated",
      header: "Updated",
      render: (row) => (
        <span className="text-xs text-dusty-lavender/50">
          {timeAgo(row.lastUpdated)}
        </span>
      ),
    },
  ];

  const availableValidators = useMemo(
    () => (data?.validators ?? []).map((v) => ({ id: v.id, moniker: v.moniker })),
    [data?.validators],
  );

  if (error && !data) {
    return (
      <ErrorState
        message="Failed to load validators"
        onRetry={() => mutate()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Search validator..."
          onSearch={handleSearch}
          className="w-full sm:w-64"
        />
        <FilterSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={handleStatusChange}
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.validators ?? []}
        total={data?.total ?? 0}
        limit={limit}
        offset={offset}
        sort={sort}
        order={order}
        onSortChange={handleSortChange}
        onPageChange={setOffset}
        isLoading={isLoading}
        emptyMessage="No validators found"
        onRowClick={(row) => router.push(`/dashboard/validators/${row.id}`)}
      />

      {/* Validator Compare */}
      <ValidatorCompare availableValidators={availableValidators} />
    </div>
  );
}

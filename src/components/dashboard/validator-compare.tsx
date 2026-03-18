"use client";

import { useState } from "react";
import { useValidatorCompare } from "@/hooks/use-leaderboard";
import { ErrorState } from "./error-state";
import { ValidatorRadarChart } from "@/components/charts/radar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = [
  "#9d8ec7", // soft-violet
  "#56b3a0", // teal
  "#e5a366", // amber
  "#e07070", // rose
  "#7ba3d9", // blue
];

interface ValidatorCompareProps {
  availableValidators?: { id: string; moniker: string }[];
}

export function ValidatorCompare({ availableValidators = [] }: ValidatorCompareProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const { data, error, isLoading, mutate } = useValidatorCompare(selectedIds);

  const addValidator = (id: string) => {
    if (selectedIds.length >= 5 || selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
    setInputValue("");
  };

  const removeValidator = (id: string) => {
    setSelectedIds((prev) => prev.filter((v) => v !== id));
  };

  const handleAddFromInput = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !selectedIds.includes(trimmed) && selectedIds.length < 5) {
      addValidator(trimmed);
    }
  };

  const filteredValidators = availableValidators.filter(
    (v) => !selectedIds.includes(v.id) && v.moniker.toLowerCase().includes(inputValue.toLowerCase()),
  );

  if (error && !data && selectedIds.length > 0) {
    return <ErrorState message="Failed to load comparison" onRetry={() => mutate()} />;
  }

  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-mist">
          Compare Validators (up to 5)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected validators */}
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id, idx) => {
            const name = data?.results.find((r) => r.validatorId === id)?.moniker ?? id;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-DEFAULT/20 bg-slate-dark/50 px-2.5 py-1 text-xs font-medium text-mist"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                {name}
                <button
                  onClick={() => removeValidator(id)}
                  aria-label={`Remove ${name}`}
                  className="ml-0.5 text-dusty-lavender/50 hover:text-mist"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          {selectedIds.length < 5 && (
            <div className="relative">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddFromInput();
                    if (e.key === "Escape") setInputValue("");
                  }}
                  placeholder="Add validator ID..."
                  role="combobox"
                  aria-expanded={!!(inputValue && filteredValidators.length > 0)}
                  aria-autocomplete="list"
                  aria-controls="validator-dropdown"
                  className="h-7 w-48 rounded-lg border border-slate-DEFAULT/20 bg-slate-dark/50 px-2 text-xs text-mist placeholder:text-dusty-lavender/30 outline-none focus:border-soft-violet/50"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddFromInput}
                  disabled={!inputValue.trim()}
                  className={cn(
                    "h-7 px-2 text-dusty-lavender/50 hover:text-mist",
                  )}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {inputValue && filteredValidators.length > 0 && (
                <div id="validator-dropdown" role="listbox" aria-label="Validator suggestions" className="absolute top-8 z-10 max-h-32 w-48 overflow-y-auto rounded-lg border border-slate-DEFAULT/20 bg-midnight-plum shadow-lg">
                  {filteredValidators.slice(0, 5).map((v) => (
                    <button
                      key={v.id}
                      role="option"
                      aria-selected={false}
                      onClick={() => addValidator(v.id)}
                      className="block w-full px-2 py-1.5 text-left text-xs text-mist hover:bg-deep-iris/20"
                    >
                      {v.moniker}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chart */}
        {isLoading && selectedIds.length > 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-soft-violet/50" />
          </div>
        )}

        {data && data.results.length > 0 && (
          <ValidatorRadarChart
            data={data.results.map((r, idx) => ({
              name: r.moniker,
              color: COLORS[idx % COLORS.length],
              metrics: r.metrics,
            }))}
          />
        )}

        {selectedIds.length === 0 && (
          <p className="py-8 text-center text-sm text-dusty-lavender/50">
            Select validators to compare their metrics
          </p>
        )}
      </CardContent>
    </Card>
  );
}

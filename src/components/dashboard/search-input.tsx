"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchInputProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  delay?: number;
  className?: string;
}

export function SearchInput({
  placeholder = "Search...",
  onSearch,
  delay = 300,
  className,
}: SearchInputProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, delay);
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    onSearchRef.current(debouncedQuery);
  }, [debouncedQuery]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-dusty-lavender/40" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="border-slate-DEFAULT/20 bg-midnight-plum pl-9 text-mist placeholder:text-dusty-lavender/30 focus-visible:border-soft-violet/50 focus-visible:ring-soft-violet/20"
      />
    </div>
  );
}

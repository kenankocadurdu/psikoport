"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { SYMPTOM_TAXONOMY } from "@psikoport/shared";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface TagAutocompleteProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

const ALL_SUGGESTIONS = [...SYMPTOM_TAXONOMY].sort((a, b) =>
  a.labelTr.localeCompare(b.labelTr)
);

export function TagAutocomplete({
  value,
  onChange,
  placeholder = "Etiket ekle (semptom veya serbest metin)",
  className,
}: TagAutocompleteProps) {
  const [input, setInput] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!input.trim()) return ALL_SUGGESTIONS.slice(0, 15);
    const q = input.toLowerCase().trim();
    return ALL_SUGGESTIONS.filter((s) =>
      s.labelTr.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [input]);

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !value.includes(t)) {
      onChange([...value, t]);
    }
    setInput("");
    setOpen(false);
    setHighlight(0);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((x) => x !== tag));
  };

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      <div className="border-input flex min-h-9 flex-wrap gap-1.5 rounded-md border bg-transparent px-3 py-2 shadow-xs">
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 pr-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:bg-muted rounded p-0.5"
              aria-label={`${tag} kaldır`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (filtered[highlight] !== undefined) {
                addTag(filtered[highlight].labelTr);
              } else if (input.trim()) {
                addTag(input.trim());
              }
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Backspace" && !input && value.length) {
              removeTag(value[value.length - 1]);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="placeholder:text-muted-foreground min-w-[120px] flex-1 border-0 bg-transparent px-0 py-0 text-sm outline-none"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="bg-popover border-input max-h-48 overflow-auto rounded-md border shadow-md">
          {filtered.map((s, i) => (
            <li key={s.code}>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-accent",
                  i === highlight && "bg-accent"
                )}
                onClick={() => addTag(s.labelTr)}
              >
                {s.labelTr}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && input.trim() && filtered.length === 0 && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground w-full rounded-md border px-3 py-2 text-left text-sm"
          onClick={() => addTag(input.trim())}
        >
          {'"'}
          {input.trim()}
          {'"'} olarak ekle
        </button>
      )}
    </div>
  );
}

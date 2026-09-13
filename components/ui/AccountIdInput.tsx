"use client";

import type { InputHTMLAttributes } from "react";

import {
  normalizeAccountIdInput,
  type AccountIdPrefix,
} from "@/lib/accountIdentifier";

type AccountIdInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "prefix"
> & {
  prefix: AccountIdPrefix;
  value: string;
  onValueChange: (value: string) => void;
};

export default function AccountIdInput({
  prefix,
  value,
  onValueChange,
  className = "",
  disabled,
  ...props
}: AccountIdInputProps) {
  return (
    <div
      className={`flex min-w-0 flex-1 rounded-2xl border border-border/80 bg-background focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center rounded-l-2xl border-r border-border/80 bg-muted/50 px-3 font-mono text-sm font-semibold"
      >
        {prefix}
      </span>

      <input
        {...props}
        disabled={disabled}
        value={value}
        onChange={(event) =>
          onValueChange(
            normalizeAccountIdInput(event.target.value, prefix)
          )
        }
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="min-h-11 w-full min-w-0 flex-1 rounded-r-2xl bg-transparent px-3 py-2.5 font-mono text-base uppercase tracking-wider outline-none sm:text-sm"
      />
    </div>
  );
}
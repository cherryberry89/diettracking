"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-8 text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

/** Horizontal progress bar. Shows the overshoot in a warning colour when value exceeds max. */
export function ProgressBar({
  value,
  max,
  label,
  tone = "accent",
  size = "md",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "accent" | "protein" | "water" | "neutral";
  size?: "sm" | "md" | "lg";
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max * 1.05;
  const fill = {
    accent: "bg-accent",
    protein: "bg-protein",
    water: "bg-water",
    neutral: "bg-ink/60",
  }[tone];
  const track = {
    accent: "bg-accent-soft",
    protein: "bg-protein-soft",
    water: "bg-water-soft",
    neutral: "bg-surface-2",
  }[tone];
  const height = { sm: "h-1.5", md: "h-2.5", lg: "h-4" }[size];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      className={`w-full overflow-hidden rounded-full ${track} ${height}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${over && tone === "accent" ? "bg-warn" : fill}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-black/45 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-line py-2 pl-5 pr-2">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/**
 * Numeric text input that lets the field be empty while typing.
 * Calls onChange with a number (0 when empty).
 */
export function NumberInput({
  value,
  onChange,
  className = "input",
  decimals = 1,
  ...rest
}: {
  value: number;
  onChange: (n: number) => void;
  decimals?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const format = (n: number) => (Number.isFinite(n) && n !== 0 ? String(+n.toFixed(decimals)) : "");
  const [text, setText] = useState(format(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    // The value was changed from outside (e.g. recalculated), so resync the text.
    setLast(value);
    if (parseFloat(text.replace(",", ".")) !== value) setText(format(value));
  }
  return (
    <input
      {...rest}
      type="text"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      className={className}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, "");
        setText(t);
        const n = parseFloat(t.replace(",", "."));
        const next = Number.isFinite(n) ? n : 0;
        setLast(next);
        onChange(next);
      }}
    />
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors ${
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

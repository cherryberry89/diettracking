"use client";

import { Camera, Check, ChevronDown, ScanBarcode, SendHorizontal, Star, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-context";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { DraftFields, formatAmount } from "@/components/DraftFields";
import { Segmented, Sheet } from "@/components/ui";
import { scaleNutrients, type BarcodeProduct } from "@/lib/barcode";
import { friendlyDate, toLocalDate } from "@/lib/dates";
import {
  addEntries,
  deleteEntries,
  listRecentFoods,
  listSavedFoods,
  saveFood,
  sumNutrients,
  uploadMealPhoto,
} from "@/lib/db";
import type { EstimateResult } from "@/lib/estimator";
import { resizeImage } from "@/lib/image";
import { apiFetch } from "@/lib/supabase";
import { MEAL_LABELS, type EntrySource, type FoodDraft, type Meal } from "@/lib/types";

type ProposalItem = FoodDraft & { key: string; favourite: boolean };

type Message =
  | { id: string; kind: "user-text"; text: string }
  | { id: string; kind: "user-photo"; url: string }
  | { id: string; kind: "bot-text"; text: string; error?: boolean }
  | {
      id: string;
      kind: "proposal";
      items: ProposalItem[];
      meal: Meal;
      source: EntrySource;
      barcode?: string;
      photoPath?: string;
    }
  | { id: string; kind: "logged"; text: string; entryIds: string[]; undone?: boolean };

const uid = () => crypto.randomUUID();
const fmt = (n: number) => Math.round(n).toLocaleString();

function mealForNow(): Meal {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17.5) return "snack";
  if (h < 21.5) return "dinner";
  return "snack";
}

const MEAL_OPTIONS = (Object.keys(MEAL_LABELS) as Meal[]).map((m) => ({
  value: m,
  label: m === "snack" ? "Snack" : MEAL_LABELS[m],
}));

export default function LogPage() {
  const { db, userId } = useApp();
  const [today] = useState(() => toLocalDate());
  const [date, setDate] = useState(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= toLocalDate() ? d : toLocalDate();
  });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "hello",
      kind: "bot-text",
      text: "What did you eat? Tell me in your own words, like “2 eggs, a slice of toast and a coffee”. You can also take a photo or scan a barcode.",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [quick, setQuick] = useState<{ saved: FoodDraft[]; recent: FoodDraft[] }>({ saved: [], recent: [] });
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const push = useCallback((m: Message) => setMessages((all) => [...all, m]), []);
  const replace = useCallback(
    (id: string, m: Message) => setMessages((all) => all.map((x) => (x.id === id ? m : x))),
    [],
  );
  const say = useCallback(
    (text: string, error = false) => push({ id: uid(), kind: "bot-text", text, error }),
    [push],
  );

  const loadQuick = useCallback(async () => {
    try {
      const [saved, recent] = await Promise.all([listSavedFoods(db), listRecentFoods(db)]);
      const savedNames = new Set(saved.map((s) => s.name.toLowerCase()));
      setQuick({ saved, recent: recent.filter((r) => !savedNames.has(r.name.toLowerCase())).slice(0, 6) });
    } catch {
      /* quick-add chips are optional */
    }
  }, [db]);

  useEffect(() => {
    loadQuick();
  }, [loadQuick]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function propose(result: EstimateResult, source: EntrySource, extra: { barcode?: string; photoPath?: string } = {}) {
    if (result.message) say(result.message);
    if (result.items.length === 0) return;
    push({
      id: uid(),
      kind: "proposal",
      items: result.items.map((i) => ({ ...i, key: uid(), favourite: false })),
      meal: result.meal ?? mealForNow(),
      source,
      ...extra,
    });
  }

  async function sendText(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    push({ id: uid(), kind: "user-text", text: value });
    setBusy(true);
    try {
      const res = await apiFetch("/api/estimate", { method: "POST", body: JSON.stringify({ type: "text", text: value }) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Request failed");
      const result = (await res.json()) as EstimateResult;
      if (pendingPhoto && result.items.length > 0) {
        propose(result, "photo", { photoPath: pendingPhoto });
        setPendingPhoto(null);
      } else {
        propose(result, "text");
      }
    } catch {
      say("I couldn't work that out just now. Check your connection and try again.", true);
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoto(file: File) {
    if (busy) return;
    setBusy(true);
    push({ id: uid(), kind: "user-photo", url: URL.createObjectURL(file) });
    try {
      const blob = await resizeImage(file);
      const path = await uploadMealPhoto(db, userId, blob);
      const res = await apiFetch("/api/estimate", { method: "POST", body: JSON.stringify({ type: "image", path }) });
      if (!res.ok) throw new Error("Request failed");
      const result = (await res.json()) as EstimateResult;
      if (result.needsDescription || result.items.length === 0) {
        setPendingPhoto(path);
        say(result.message);
      } else {
        propose(result, "photo", { photoPath: path });
      }
    } catch {
      say("That photo couldn't be uploaded. Try again, or describe the meal instead.", true);
    } finally {
      setBusy(false);
    }
  }

  async function lookupBarcode(code: string) {
    setScanning(false);
    push({ id: uid(), kind: "user-text", text: `Barcode ${code}` });
    setBusy(true);
    try {
      const res = await apiFetch(`/api/barcode/${code}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) return say(data?.error ?? "Couldn't look that barcode up.", true);
      const p = data as BarcodeProduct;
      const amount = p.servingQuantity ?? 100;
      propose(
        {
          message: p.servingQuantity
            ? `Found it. I've set the amount to one serving (${p.servingLabel ?? `${amount} ${p.baseUnit}`}). Change it to what you had.`
            : `Found it. Values are for 100 ${p.baseUnit}. Change the amount to what you had.`,
          items: [
            {
              name: p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.name} (${p.brand})` : p.name,
              quantity: amount,
              unit: p.baseUnit,
              ...scaleNutrients(p.per100, amount),
              confidence: "high",
            },
          ],
        },
        "barcode",
        { barcode: code },
      );
    } catch {
      say("Couldn't reach the product database. Check your connection and try again.", true);
    } finally {
      setBusy(false);
    }
  }

  async function quickAdd(food: FoodDraft) {
    if (busy) return;
    setBusy(true);
    try {
      const meal = mealForNow();
      const rows = await addEntries(db, [food], { date, meal, source: "saved" });
      push({
        id: uid(),
        kind: "logged",
        text: `Added ${food.name} to ${MEAL_LABELS[meal].toLowerCase()} · ${fmt(food.calories)} kcal · ${fmt(food.protein_g)} g protein`,
        entryIds: rows.map((r) => r.id),
      });
    } catch {
      say("That couldn't be saved. Please try again.", true);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(m: Extract<Message, { kind: "proposal" }>) {
    const items = m.items.filter((i) => i.name.trim());
    if (items.length === 0) return;
    setBusy(true);
    try {
      const rows = await addEntries(db, items, {
        date,
        meal: m.meal,
        source: m.source,
        barcode: m.barcode,
        photoPath: m.photoPath,
      });
      await Promise.all(items.filter((i) => i.favourite).map((i) => saveFood(db, i)));
      const t = sumNutrients(items);
      replace(m.id, {
        id: m.id,
        kind: "logged",
        text: `Added ${items.length === 1 ? items[0].name : `${items.length} items`} to ${MEAL_LABELS[m.meal].toLowerCase()} · ${fmt(t.calories)} kcal · ${fmt(t.protein_g)} g protein`,
        entryIds: rows.map((r) => r.id),
      });
      loadQuick();
    } catch {
      say("That couldn't be saved. Please try again.", true);
    } finally {
      setBusy(false);
    }
  }

  async function undo(m: Extract<Message, { kind: "logged" }>) {
    try {
      await deleteEntries(db, m.entryIds);
      replace(m.id, { ...m, undone: true });
    } catch {
      say("Couldn't undo that. You can remove it from the Today screen.", true);
    }
  }

  return (
    <div className="-mb-12 flex h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] flex-col md:mb-0 md:h-[calc(100dvh-4.5rem)]">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Log food</h1>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only">Day to log to</span>
          <span aria-hidden="true">{friendlyDate(date, today)}</span>
          <input
            type="date"
            className="input min-h-9 w-auto px-2 text-sm"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
      </header>

      <div className="-mx-4 flex-1 space-y-3 overflow-y-auto px-4 pb-3" role="log" aria-live="polite">
        {messages.map((m) => {
          switch (m.kind) {
            case "user-text":
              return (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-ink">
                    {m.text}
                  </p>
                </div>
              );
            case "user-photo":
              return (
                <div key={m.id} className="flex justify-end">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the user's own photo */}
                  <img src={m.url} alt="Your meal photo" className="max-h-56 max-w-[70%] rounded-2xl rounded-br-md object-cover" />
                </div>
              );
            case "bot-text":
              return (
                <p
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl rounded-bl-md border px-4 py-2.5 ${
                    m.error ? "border-danger/30 bg-danger/10 text-danger" : "border-line bg-surface"
                  }`}
                >
                  {m.text}
                </p>
              );
            case "proposal":
              return (
                <Proposal
                  key={m.id}
                  message={m}
                  busy={busy}
                  onChange={(next) => replace(m.id, next)}
                  onConfirm={() => confirm(m)}
                  onDismiss={() => setMessages((all) => all.filter((x) => x.id !== m.id))}
                />
              );
            case "logged":
              return (
                <div
                  key={m.id}
                  className="flex max-w-[92%] items-center gap-3 rounded-2xl rounded-bl-md border border-line bg-surface py-1.5 pl-4 pr-1.5"
                >
                  <Check size={18} className={m.undone ? "text-muted" : "text-accent"} aria-hidden="true" />
                  <p className={`flex-1 py-1 text-sm ${m.undone ? "text-muted line-through" : ""}`}>{m.text}</p>
                  {m.undone ? (
                    <span className="pr-3 text-sm text-muted">Removed</span>
                  ) : (
                    <button className="btn-ghost min-h-9 px-3" onClick={() => undo(m)}>
                      <Undo2 size={15} aria-hidden="true" /> Undo
                    </button>
                  )}
                </div>
              );
          }
        })}
        {busy && (
          <p className="w-fit rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-2.5 text-muted" role="status">
            Working…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {(quick.saved.length > 0 || quick.recent.length > 0) && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 py-2" aria-label="Quick add">
          {quick.saved.map((f) => (
            <QuickChip key={`s-${f.name}`} food={f} saved onClick={() => quickAdd(f)} disabled={busy} />
          ))}
          {quick.recent.map((f) => (
            <QuickChip key={`r-${f.name}`} food={f} onClick={() => quickAdd(f)} disabled={busy} />
          ))}
        </div>
      )}

      <form onSubmit={sendText} className="flex items-end gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) sendPhoto(f);
          }}
        />
        <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Add a photo of your meal">
          <Camera size={22} />
        </button>
        <button type="button" className="icon-btn" onClick={() => setScanning(true)} disabled={busy} aria-label="Scan a barcode">
          <ScanBarcode size={22} />
        </button>
        <label htmlFor="chat-input" className="sr-only">
          What did you eat?
        </label>
        <textarea
          id="chat-input"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={pendingPhoto ? "What's in the photo?" : "What did you eat?"}
          className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base placeholder:text-muted/70 focus:outline-none"
        />
        <button type="submit" className="btn-primary size-11 px-0" disabled={busy || !text.trim()} aria-label="Send">
          <SendHorizontal size={20} />
        </button>
      </form>

      <Sheet open={scanning} onClose={() => setScanning(false)} title="Scan a barcode">
        {scanning && <BarcodeScanner onCode={lookupBarcode} />}
      </Sheet>
    </div>
  );
}

function QuickChip({
  food,
  saved = false,
  onClick,
  disabled,
}: {
  food: FoodDraft;
  saved?: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Add ${food.name}, ${fmt(food.calories)} kcal`}
      className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm hover:bg-surface-2 disabled:opacity-50"
    >
      {saved && <Star size={14} className="text-accent" fill="currentColor" aria-hidden="true" />}
      <span className="max-w-40 truncate font-medium">{food.name}</span>
      <span className="tabular-nums text-muted">{fmt(food.calories)}</span>
    </button>
  );
}

function Proposal({
  message,
  busy,
  onChange,
  onConfirm,
  onDismiss,
}: {
  message: Extract<Message, { kind: "proposal" }>;
  busy: boolean;
  onChange: (m: Message) => void;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState<string | null>(
    () => message.items.find((i) => i.confidence === "none")?.key ?? null,
  );
  const totals = sumNutrients(message.items);
  const setItems = (items: ProposalItem[]) => onChange({ ...message, items });
  const needsValues = message.items.some((i) => i.confidence === "none" && i.calories === 0);

  return (
    <section className="card max-w-[96%] space-y-3 rounded-bl-md p-3" aria-label="Suggested entry">
      <ul className="space-y-2">
        {message.items.map((item) => {
          const expanded = open === item.key;
          return (
            <li key={item.key} className="rounded-xl border border-line">
              <div className="flex items-center gap-1 pl-3">
                <button
                  type="button"
                  className="flex min-h-12 flex-1 cursor-pointer items-center justify-between gap-2 py-1.5 text-left"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : item.key)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.name || "Unnamed food"}</span>
                    <span className="hint">
                      {formatAmount(item)}
                      {item.confidence === "none" && item.calories === 0 && (
                        <span className="text-warn"> · needs values</span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-right text-sm tabular-nums">
                    <span>
                      <span className="block font-semibold">{fmt(item.calories)} kcal</span>
                      <span className="text-protein">{fmt(item.protein_g)} g protein</span>
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-pressed={item.favourite}
                  aria-label={`Save ${item.name} as a favourite`}
                  onClick={() => setItems(message.items.map((i) => (i.key === item.key ? { ...i, favourite: !i.favourite } : i)))}
                >
                  <Star size={18} className={item.favourite ? "text-accent" : ""} fill={item.favourite ? "currentColor" : "none"} />
                </button>
              </div>
              {expanded && (
                <div className="space-y-3 border-t border-line p-3">
                  <DraftFields
                    draft={item}
                    onChange={(d) => setItems(message.items.map((i) => (i.key === item.key ? { ...i, ...d } : i)))}
                  />
                  {message.items.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost -ml-2 text-danger"
                      onClick={() => setItems(message.items.filter((i) => i.key !== item.key))}
                    >
                      <Trash2 size={16} aria-hidden="true" /> Remove this item
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between px-1 text-sm">
        <span className="text-muted">Total</span>
        <span className="tabular-nums">
          <strong>{fmt(totals.calories)} kcal</strong>
          <span className="text-muted">
            {" "}
            · {fmt(totals.protein_g)} g protein · {fmt(totals.carbs_g)} g carbs · {fmt(totals.fat_g)} g fat
          </span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <Segmented
          label="Meal"
          value={message.meal}
          onChange={(meal) => onChange({ ...message, meal })}
          options={MEAL_OPTIONS}
        />
      </div>

      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1" onClick={onConfirm} disabled={busy}>
          Add to log
        </button>
        <button type="button" className="btn-ghost" onClick={onDismiss} disabled={busy}>
          Discard
        </button>
      </div>
      {needsValues && (
        <p className="hint text-xs">Items marked “needs values” will be logged with zero calories unless you fill them in.</p>
      )}
    </section>
  );
}

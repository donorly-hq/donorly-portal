"use client";

import { createContext, useContext } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-emerald text-white hover:bg-emerald-dark",
    secondary: "border border-emerald/30 text-emerald hover:bg-emerald/5",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-emerald hover:bg-emerald/5",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-black/5 bg-white p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-black/50">{label}</span>
      <span className="text-3xl font-bold text-emerald">{value}</span>
      {hint ? <span className="text-xs text-black/40">{hint}</span> : null}
    </Card>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald focus:ring-1 focus:ring-emerald",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald focus:ring-1 focus:ring-emerald",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-emerald focus:ring-1 focus:ring-emerald",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-black/70">{label}</span>
      {children}
    </label>
  );
}

type BadgeVariant = "neutral" | "success" | "warning" | "info" | "primary" | "danger";

export function Badge({
  children,
  tone,
  variant,
}: {
  children: ReactNode;
  tone?: BadgeVariant;
  variant?: BadgeVariant;
}) {
  const resolved = variant ?? tone ?? "neutral";
  const tones: Record<BadgeVariant, string> = {
    neutral: "bg-black/5 text-black/60",
    success: "bg-emerald/10 text-emerald",
    warning: "bg-amber-50 text-amber-700",
    info: "bg-blue-50 text-blue-700",
    primary: "bg-emerald/10 text-emerald",
    danger: "bg-red-50 text-red-700",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", tones[resolved])}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl text-emerald">{title}</h2>
          <button className="text-2xl leading-none text-black/40 hover:text-black" onClick={onClose}>
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl text-emerald">{title}</h1>
        {subtitle ? <p className="text-sm text-black/50">{subtitle}</p> : null}
      </div>
      {action ?? children}
    </div>
  );
}

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };
  return (
    <div className="flex items-center justify-center py-4 text-emerald/60">
      <span className={cn("animate-spin rounded-full border-2 border-emerald/30 border-t-emerald", dims[size])} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon && <span className="text-4xl">{icon}</span>}
      <h3 className="text-base font-semibold text-slate-700">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

const TabsContext = createContext<{ value: string; onChange: (v: string) => void } | null>(null);

export function Tabs({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className="flex gap-1 border-b border-black/10 mb-4">
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function Tab({ value, label }: { value: string; label: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.onChange(value)}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
        active
          ? "border-emerald text-emerald"
          : "border-transparent text-slate-500 hover:text-slate-700",
      )}
    >
      {label}
    </button>
  );
}

export function currency(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Convert a value from a datetime-local input to an ISO instant, or null. */
export function toInstant(localValue: string): string | null {
  if (!localValue) return null;
  return new Date(localValue).toISOString();
}

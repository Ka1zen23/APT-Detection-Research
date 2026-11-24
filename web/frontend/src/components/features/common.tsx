import * as React from "react";
import { AlertTriangle, Info, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { statusMeta } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = statusMeta[status as keyof typeof statusMeta] ?? statusMeta.planned;
  const Icon = meta.icon;
  return (
    <Badge variant={meta.tone} className={className}>
      <Icon className="size-2.5" />
      {meta.label}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const variant = severity === "high" ? "error" : severity === "medium" ? "warning" : "neutral";
  return <Badge variant={variant}>{severity}</Badge>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  source,
  href,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  source?: string;
  href?: string;
  tone?: "default" | "success" | "warning" | "error" | "accent";
  icon?: React.ReactNode;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
    accent: "text-primary",
  }[tone];

  const content = (
    <Card className="group h-full p-3.5 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {icon && <div className="text-muted-foreground/70">{icon}</div>}
      </div>
      <div className={cn("mt-1.5 font-mono text-xl font-semibold tracking-tight tabular", toneClass)}>
        {value}
      </div>
      {detail && <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</div>}
      {source && (
        <div className="mt-2 truncate font-mono text-[9px] text-muted-foreground/70" title={source}>
          {source}
        </div>
      )}
    </Card>
  );

  return href ? <Link to={href}>{content}</Link> : content;
}

export function InfoCallout({
  title,
  children,
  tone = "info",
  icon,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  tone?: "info" | "warning" | "error" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-primary/20 bg-primary/5 text-primary",
    warning: "border-warning/25 bg-warning/5 text-warning",
    error: "border-error/25 bg-error/5 text-error",
    neutral: "border-border bg-elevated text-muted-foreground",
  };
  const DefaultIcon =
    tone === "warning" ? AlertTriangle : tone === "error" ? ShieldAlert : Info;
  return (
    <div className={cn("rounded-md border px-3.5 py-3", tones[tone], className)}>
      <div className="flex gap-2.5">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : <DefaultIcon className="mt-0.5 size-4 shrink-0" />}
        <div className="min-w-0 text-foreground">
          {title && <div className="text-xs font-semibold">{title}</div>}
          <div className={cn("text-xs leading-relaxed", title && "mt-0.5", "text-muted-foreground")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SourceNote({ source, className }: { source?: string | null; className?: string }) {
  if (!source) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 truncate font-mono text-[9px] text-muted-foreground/75",
        className,
      )}
      title={source}
    >
      <span className="size-1 shrink-0 rounded-full bg-muted-foreground/50" />
      {source}
    </div>
  );
}

export function LoadingBlock({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={cn("h-9 w-full", index === 0 && "h-14")} />
      ))}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-xs text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}…
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  return (
    <Card className={cn("border-error/30 p-4", className)}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 text-error" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">Unable to load research data</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{message}</div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Confirm the read-only API is running on port 8000 and the artifact files are present.
          </div>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw /> Retry
          </Button>
        )}
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <div className="text-xs font-semibold text-foreground">{title}</div>
      {description && (
        <div className="max-w-md text-xs leading-relaxed text-muted-foreground">{description}</div>
      )}
      {action}
    </div>
  );
}

export function DataAvailability({ available, label = "Data" }: { available: boolean; label?: string }) {
  return (
    <Badge variant={available ? "success" : "neutral"}>
      {label} {available ? "available" : "unavailable"}
    </Badge>
  );
}

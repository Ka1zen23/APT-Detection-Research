import * as React from "react";
import { AlertTriangle, Info, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { statusMeta } from "@/lib/nav";
import { metricById } from "@/lib/metrics";
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
    <header className="flex flex-col gap-4 border-b border-border pb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-medium leading-tight tracking-tight text-foreground md:text-[2rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground">
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
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-[18px] font-medium leading-snug tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  detail,
  definition,
  metricId,
  source,
  href,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  detail?: React.ReactNode;
  definition?: React.ReactNode;
  metricId?: string;
  source?: string;
  href?: string;
  tone?: "default" | "success" | "warning" | "error" | "accent";
  icon?: React.ReactNode;
}) {
  const resolvedDefinition = definition ?? (metricId ? metricById[metricId]?.short : undefined);
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
    accent: "text-primary",
  }[tone];

  const content = (
    <Card className="group flex h-full flex-col p-5 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium leading-snug text-muted-foreground">{label}</div>
        {icon && <div className="shrink-0 text-muted-foreground/70">{icon}</div>}
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-1.5">
        <span
          className={cn(
            "font-sans text-[2rem] font-medium leading-none tracking-tight tabular",
            toneClass,
          )}
        >
          {value}
        </span>
        {unit && <span className="text-[13px] text-muted-foreground">{unit}</span>}
      </div>
      {resolvedDefinition && (
        <p className="mt-3 max-w-[42ch] text-[13px] leading-relaxed text-muted-foreground">
          {resolvedDefinition}
        </p>
      )}
      {detail && (
        <div className="mt-2 max-w-[42ch] text-[13px] leading-relaxed text-muted-foreground">
          {detail}
        </div>
      )}
      {source && <SourceNote source={source} className="mt-auto pt-4" compact />}
    </Card>
  );

  return href ? (
    <Link
      to={href}
      className="block h-full min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  ) : (
    content
  );
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
    <div className={cn("rounded-lg border px-4 py-3.5", tones[tone], className)}>
      <div className="flex gap-2.5">
        {icon ? (
          <span className="mt-0.5 shrink-0">{icon}</span>
        ) : (
          <DefaultIcon className="mt-0.5 size-4 shrink-0" />
        )}
        <div className="min-w-0 text-foreground">
          {title && <div className="text-[13px] font-medium">{title}</div>}
          <div className={cn("text-[13px] leading-relaxed", title && "mt-1", "text-muted-foreground")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SourceNote({
  source,
  className,
  compact = false,
}: {
  source?: string | null;
  className?: string;
  compact?: boolean;
}) {
  if (!source) return null;
  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-1.5 text-[12px] leading-relaxed text-muted-foreground/80",
        className,
      )}
      title={source}
    >
      <span className="shrink-0 font-medium text-muted-foreground">Source</span>
      <span
        className={cn(
          "min-w-0 font-mono",
          compact ? "block truncate" : "break-words",
        )}
      >
        {source}
      </span>
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
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
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
          <div className="text-[13px] font-medium text-foreground">Unable to load research data</div>
          <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{message}</div>
          <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
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
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {description && (
        <div className="max-w-md text-[13px] leading-relaxed text-muted-foreground">{description}</div>
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

import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Database,
  HardDrive,
  Loader2,
  Moon,
  Monitor,
  RefreshCw,
  Server,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, InfoCallout, LoadingBlock, PageHeader, SourceNote } from "@/components/features/common";
import { useTheme } from "@/hooks/use-theme";
import { useHealth, useOverview, useRefreshData } from "@/hooks/queries";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const THEMES = [
  { id: "light", label: "Light", description: "High-contrast academic light surface", icon: Sun },
  { id: "dark", label: "Dark", description: "Low-light analysis workspace", icon: Moon },
  { id: "system", label: "System", description: "Follow the operating system preference", icon: Monitor },
] as const;

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data: health, isLoading, error, refetch } = useHealth();
  const { data: overview } = useOverview();
  const refresh = useRefreshData();
  const queryClient = useQueryClient();

  if (isLoading) return <LoadingBlock rows={6} />;
  if (error || !health) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System · Settings"
        title="Dashboard settings"
        description="Appearance, data refresh and read-only system status. Research data cannot be edited from this interface."
        actions={<Badge variant="success">Local preferences only</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <div className="text-xs text-muted-foreground">Theme is stored in this browser. No research artifact is modified.</div>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          {THEMES.map((option) => {
            const Icon = option.icon;
            const active = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
                  active ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30",
                )}
              >
                <div className={cn("grid size-7 shrink-0 place-items-center rounded border", active ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    {option.label}
                    {active && <Check className="size-3 text-primary" />}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{option.description}</div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5"><RefreshCw className="size-3.5" /> Data refresh</CardTitle>
            <div className="text-xs text-muted-foreground">Clear the API's in-memory cache and refetch every dashboard query.</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded border border-border bg-elevated/50 px-3 py-2.5">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Last artifact update</div>
              <div className="mt-0.5 font-mono text-[11px] text-foreground">{formatDateTime(health.last_artifact_update)}</div>
              <div className="text-[9px] text-muted-foreground">{relativeTime(health.last_artifact_update)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                {refresh.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Refresh research data
              </Button>
              <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
                Refetch queries only
              </Button>
            </div>
            <div className="text-[10px] leading-relaxed text-muted-foreground">
              Refresh does not read model checkpoints and does not modify the filesystem. It only invalidates
              mtime-aware caches so newly generated JSON/CSV/Parquet artifacts can appear.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5"><Server className="size-3.5" /> API status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              ["Status", health.status],
              ["Version", health.version],
              ["API prefix", health.api_prefix],
              ["Read-only", String(health.read_only)],
              ["Deployment mode", health.deployment_mode ?? "local"],
              ["API key required", String(Boolean(health.auth_required))],
              ["Repository root", health.repository_root_exists ? "present" : "missing"],
              ["Checked at", formatDateTime(health.checked_at)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-border pb-1.5 last:border-0">
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="font-mono text-[10px] text-foreground">{value}</span>
              </div>
            ))}
            <div className="pt-1">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Allowlisted artifact roots</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {health.allowed_artifact_roots.map((root) => <Badge key={root} variant="outline" className="font-mono">{root}</Badge>)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><Database className="size-3" /> Data mode</div>
          <div className="mt-1 text-sm font-semibold text-foreground">Live artifacts</div>
          <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">JSON, CSV and Parquet research outputs. No database, no duplicate warehouse.</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><HardDrive className="size-3" /> Cache</div>
          <div className="mt-1 text-sm font-semibold text-foreground">In-memory only</div>
          <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">Per-file mtime invalidation. Event index built lazily and never persisted to disk.</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><ShieldCheck className="size-3" /> Safety</div>
          <div className="mt-1 text-sm font-semibold text-foreground">No checkpoint execution</div>
          <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">No model is loaded or retrained. No command-line contents or secrets are exposed.</div>
        </Card>
      </div>

      <InfoCallout tone="info" title="Research status summary">
        {overview ? `${overview.counts.completed} completed entries, ${overview.counts.in_progress} in progress and ${overview.counts.planned} planned. ${overview.research.implementation_note}` : "Loading research status…"}
      </InfoCallout>

      <Card className="p-4">
        <div className="text-xs font-semibold text-foreground">About this dashboard</div>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Built as an isolated web/ application for the Master's research project
          &ldquo;AI-based solution to detect and mitigate APT malware&rdquo; at Universiti Teknologi Brunei.
          It presents existing research artifacts and does not itself constitute experimental evidence.
        </p>
        <SourceNote className="mt-2" source="web/frontend + web/backend + web/content" />
      </Card>
    </div>
  );
}

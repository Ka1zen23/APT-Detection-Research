import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronRight,
  Loader2,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";
import { useHealth, useRefreshData, useResearchStatus } from "@/hooks/queries";
import { isStaticDataMode } from "@/services/api";
import { flatNav } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { formatDateTime, relativeTime } from "@/lib/format";
import { CommandPalette } from "@/components/CommandPalette";
import { SidebarToggleButton } from "@/layouts/Sidebar";

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const base = flatNav.find((item) => item.to === location.pathname);
  let trail: { label: string; to?: string }[] = [];

  if (segments.length === 2 && segments[0] === "experiments") {
    trail = [
      { label: "Experiments", to: "/experiments" },
      { label: segments[1] },
    ];
  } else if (segments.length === 2 && segments[0] === "journal") {
    trail = [
      { label: "Research Journal", to: "/journal" },
      { label: segments[1] },
    ];
  } else {
    trail = [{ label: base?.label ?? "Overview", to: location.pathname }];
  }

  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-[13px] text-muted-foreground sm:flex">
      <Link to="/" className="transition-colors hover:text-foreground">
        Research
      </Link>
      {trail.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          <ChevronRight className="size-3 text-muted-foreground/50" />
          {item.to && index < trail.length - 1 ? (
            <Link to={item.to} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className={cn("text-foreground", index === trail.length - 1 && "font-medium")}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { data: health } = useHealth();
  const { data: research } = useResearchStatus();
  const refresh = useRefreshData();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6 lg:px-8">
        <div className="md:hidden">
          <SidebarToggleButton onClick={onOpenNav} />
        </div>
        <Breadcrumbs />
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground sm:flex"
          >
            <Search className="size-4" />
            <span>Search research…</span>
            <kbd className="ml-2 rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[11px]">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search />
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 lg:flex">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    health?.status === "ok" ? "bg-success" : "bg-error",
                  )}
                />
                <span className="text-[12px] text-muted-foreground">
                  {health?.status === "ok" ? "API live" : "API offline"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Read-only API at {health?.api_prefix ?? "/api/v1"}. Last artifact update{" "}
              {relativeTime(health?.last_artifact_update)}.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 xl:flex">
                <span className="size-1.5 rounded-full bg-warning" />
                <span className="max-w-44 truncate text-[12px] text-muted-foreground">
                  {research?.status ?? "Research active"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{research?.phase}</TooltipContent>
          </Tooltip>

          <div
            className="hidden items-center gap-1 text-[12px] text-muted-foreground lg:flex"
            title={formatDateTime(health?.last_artifact_update)}
          >
            <span>Updated {relativeTime(health?.last_artifact_update)}</span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => (isStaticDataMode ? window.location.reload() : refresh.mutate())}
                disabled={!isStaticDataMode && refresh.isPending}
                aria-label={isStaticDataMode ? "Reload static snapshot" : "Refresh research data"}
              >
                {!isStaticDataMode && refresh.isPending ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <RefreshCw />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isStaticDataMode
                ? "Reload the static snapshot. New research data requires a new export and redeploy."
                : "Clear the in-memory cache and refetch all research data."}
            </TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
            aria-label="Cycle theme"
            title={`Theme: ${theme}`}
          >
            {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
          </Button>
          <div className="relative hidden sm:block">
            {theme === "dark" ? (
              <Moon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            ) : theme === "light" ? (
              <Sun className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            ) : (
              <Monitor className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            )}
            <Select
              value={theme}
              onChange={(event) => setTheme(event.target.value as "light" | "dark" | "system")}
              className="h-9 w-[104px] pl-7 text-[12px]"
              aria-label="Theme"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </Select>
          </div>
          <Badge variant="outline" className="hidden xl:inline-flex">
            Preliminary
          </Badge>
        </div>
      </header>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

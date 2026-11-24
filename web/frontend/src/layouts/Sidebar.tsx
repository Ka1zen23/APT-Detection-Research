import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, FlaskConical, PanelLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { navGroups } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useHealth, useResearchStatus } from "@/hooks/queries";
import { relativeTime } from "@/lib/format";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-3 py-3.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 font-mono text-[11px] font-bold text-primary">
        AR
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold tracking-tight text-foreground">
            APT Research Lab
          </div>
          <div className="truncate text-[10px] text-muted-foreground">UTB · MRes dashboard</div>
        </div>
      )}
    </Link>
  );
}

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-4">
      {navGroups.map((group) => (
        <div key={group.label} className="mb-3">
          {!collapsed && (
            <div className="px-2 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
              {group.label}
            </div>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-elevated hover:text-foreground",
                      collapsed && "justify-center px-1.5",
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function SidebarFooter({ collapsed = false }: { collapsed?: boolean }) {
  const { data: health } = useHealth();
  const { data: research } = useResearchStatus();
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-border py-3">
        <span className="size-2 rounded-full bg-warning" title={research?.status ?? "Research active"} />
        <span className="font-mono text-[9px] text-muted-foreground">v1</span>
      </div>
    );
  }
  return (
    <div className="border-t border-border px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning/60" />
          <span className="relative inline-flex size-2 rounded-full bg-warning" />
        </span>
        <span className="truncate text-[10px] font-medium text-foreground">
          {research?.status ?? "Research status"}
        </span>
      </div>
      <div className="mt-1.5 truncate text-[9px] text-muted-foreground">
        Artifacts updated {relativeTime(health?.last_artifact_update)}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Badge variant="outline" className="text-[9px]">
          Read-only
        </Badge>
        <Badge variant={health?.status === "ok" ? "success" : "neutral"} className="text-[9px]">
          API {health?.status === "ok" ? "live" : "offline"}
        </Badge>
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div className="flex items-center justify-between">
        <Brand compact={collapsed} />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          className={cn("mr-2", collapsed && "hidden")}
          aria-label="Collapse sidebar"
        >
          <ChevronsLeft />
        </Button>
      </div>
      {collapsed && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          className="mx-auto mb-2"
          aria-label="Expand sidebar"
        >
          <ChevronsRight />
        </Button>
      )}
      <SidebarNav collapsed={collapsed} />
      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0">
        <Brand />
        <SidebarNav onNavigate={() => onOpenChange(false)} />
        <SidebarFooter />
      </SheetContent>
    </Sheet>
  );
}

export function SidebarToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label="Open navigation">
      <PanelLeft />
    </Button>
  );
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("apt-sidebar") === "collapsed");
  const toggle = () => {
    setCollapsed((previous) => {
      const next = !previous;
      localStorage.setItem("apt-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  };
  return { collapsed, toggle };
}

export function ExperimentBadge({ id }: { id: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
      <FlaskConical className="size-2.5 text-muted-foreground" />
      {id}
    </span>
  );
}

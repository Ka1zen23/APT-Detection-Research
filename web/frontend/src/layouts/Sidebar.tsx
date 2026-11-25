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
    <Link to="/" className="flex items-center gap-3 px-4 py-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 font-mono text-[12px] font-medium text-primary">
        AR
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium tracking-tight text-foreground">
            APT Research Lab
          </div>
          <div className="truncate text-[12px] text-muted-foreground">UTB research dashboard</div>
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
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      {navGroups.map((group) => (
        <div key={group.label} className="mb-3">
          {!collapsed && (
            <div className="px-2 pb-1 pt-3 text-[12px] font-medium text-muted-foreground">
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
                      "group flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium transition-colors",
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
      <div className="flex shrink-0 flex-col items-center gap-2 border-t border-border py-3">
        <span className="size-2 rounded-full bg-warning" title={research?.status ?? "Research active"} />
        <span className="font-mono text-[12px] text-muted-foreground">v1</span>
      </div>
    );
  }
  return (
    <div className="shrink-0 border-t border-border px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning/60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-warning" />
        </span>
        <span className="truncate text-[12px] font-medium text-foreground">
          {research?.status ?? "Research status"}
        </span>
      </div>
      <div className="mt-1.5 truncate text-[12px] text-muted-foreground">
        Artifacts updated {relativeTime(health?.last_artifact_update)}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Badge variant="outline">Read-only</Badge>
        <Badge variant={health?.status === "ok" ? "success" : "neutral"}>
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
        "hidden h-full shrink-0 flex-col overflow-hidden border-r border-border bg-surface md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div className="flex shrink-0 items-center justify-between">
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
    <span className="inline-flex items-center gap-1 rounded border border-border bg-elevated px-2 py-0.5 font-mono text-[12px] font-medium text-foreground">
      <FlaskConical className="size-3 text-muted-foreground" />
      {id}
    </span>
  );
}

import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MobileSidebar, Sidebar, useSidebarCollapsed } from "@/layouts/Sidebar";
import { Topbar } from "@/layouts/Topbar";
import { useHealth } from "@/hooks/queries";
import { formatDateTime, relativeTime } from "@/lib/format";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  const location = useLocation();
  const { data: health } = useHealth();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setMobileOpen(true)} />
        <main className="flex-1 px-3 py-5 md:px-5 lg:px-6">
          <div className="mx-auto w-full max-w-[1500px] animate-in">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-border px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-2 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              APT Research Lab · Universiti Teknologi Brunei · Read-only research artifact viewer
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span title={formatDateTime(health?.last_artifact_update)}>
                Artifacts updated{" "}
                <span className="font-mono text-foreground">
                  {relativeTime(health?.last_artifact_update)}
                </span>
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>No production detection or mitigation claim is made.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

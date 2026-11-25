import { useEffect, useRef, useState } from "react";
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
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setMobileOpen(true)} />
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px] animate-in">
            <Outlet />
            <footer className="mt-10 border-t border-border pt-5">
              <div className="flex flex-col gap-2 text-[12px] leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div>
                  APT Research Lab. Universiti Teknologi Brunei. Read-only research artifact viewer.
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span title={formatDateTime(health?.last_artifact_update)}>
                    Artifacts updated{" "}
                    <span className="font-mono text-foreground">
                      {relativeTime(health?.last_artifact_update)}
                    </span>
                  </span>
                  <span>No production detection or mitigation claim is made.</span>
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

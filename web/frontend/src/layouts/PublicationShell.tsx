import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/use-theme";
import "@/publication.css";

const sections = [
  ["Overview", "/"],
  ["Understand the Research", "/understand"],
  ["Findings", "/findings"],
  ["Experiments", "/experiments"],
  ["Progress", "/progress"],
  ["Documentation", "/documentation"],
] as const;

export function PublicationShell() {
  const [menu, setMenu] = useState(false);
  const { pathname, hash } = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const main = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    setMenu(false);
    window.scrollTo(0, 0);
    const content = main.current;
    content?.focus({ preventScroll: true });
    if (content?.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const animation = content.animate([{ opacity: 0.85 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
      return () => animation.cancel();
    }
  }, [pathname]);
  useEffect(() => {
    if (!hash || !main.current) return;
    const scroll = () => {
      const target = document.getElementById(hash.slice(1));
      target?.scrollIntoView();
      return Boolean(target);
    };
    if (scroll()) return;
    const observer = new MutationObserver(() => { if (scroll()) observer.disconnect(); });
    observer.observe(main.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, hash]);
  useEffect(() => {
    if (menu) navigation.current?.querySelector("a")?.focus();
  }, [menu]);
  useEffect(() => {
    if (!main.current) return;
    const update = () => {
      const title = main.current?.querySelector("h1")?.textContent;
      document.title = pathname !== "/" && title ? `${title} · APT Research Lab` : "APT Research Lab · UTB";
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(main.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  const parts = pathname.split("/").filter(Boolean);
  const parent = sections.find(([, path]) => path === `/${parts[0]}`);
  const dark = resolvedTheme === "dark";

  return (
    <div className="pub" onKeyDown={(event) => {
      if (menu && event.key === "Escape") { setMenu(false); menuButton.current?.focus(); }
    }}>
      <a className="pub-skip" href="#publication-main">Skip to content</a>
      <header className="pub-header">
        <div className="pub-wrap pub-header-inner">
          <Link className="pub-brand" to="/" aria-label="APT Research Lab home">
            <svg viewBox="0 0 36 36" aria-hidden="true">
              <rect width="36" height="36" rx="9" fill="currentColor" />
              <path d="m10 22 8-11 8 11H10m8-11v14" fill="none" stroke="var(--p-brand-ink)" strokeWidth="1.25" />
              <path d="M10 22h0m8-11h0m8 11h0m-8 3h0" stroke="var(--p-brand-ink)" strokeLinecap="round" strokeWidth="4" />
            </svg>
            APT Research Lab
          </Link>
          <nav ref={navigation} id="publication-navigation" className="pub-nav" aria-label="Main navigation" data-open={menu}>
            {sections.map(([label, to]) => (
              <NavLink end={to === "/"} key={to} to={to} onClick={() => setMenu(false)}>{label}</NavLink>
            ))}
          </nav>
          <div className="pub-header-actions">
            <button className="pub-icon" aria-label={`Switch to ${dark ? "light" : "dark"} theme`} type="button" onClick={() => setTheme(dark ? "light" : "dark")}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button ref={menuButton} className="pub-icon pub-menu" type="button" aria-label={menu ? "Close menu" : "Open menu"} aria-controls="publication-navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
      <main id="publication-main" ref={main} tabIndex={-1} className={pathname === "/" ? undefined : "pub-wrap pub-page"}>
        {parts.length > 1 && parent && (
          <nav aria-label="Breadcrumb" className="pub-crumb">
            <Link to="/">Overview</Link><span aria-hidden="true">/</span><Link to={parent[1]}>{parent[0]}</Link>
          </nav>
        )}
        <Suspense fallback={<div className="pub-lede" role="status">Loading research page…</div>}><Outlet /></Suspense>
      </main>
      <footer className="pub-footer">
        <div className="pub-wrap pub-footer-inner">
          <div><Link className="pub-brand" to="/">APT Research Lab</Link><p>MSc Cybersecurity · Universiti Teknologi Brunei</p></div>
          <Link className="pub-text-link" to="/documentation/limitations">Research limitations <ArrowUpRight size={15} /></Link>
        </div>
      </footer>
    </div>
  );
}

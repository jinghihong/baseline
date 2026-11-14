// The signed-in product frame: sidebar navigation grouped by role, top bar with search, theme and AI status.
import { Menu, Moon, Search, Sparkles, Sun, X } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router";
import { NAV_BY_ROLE, ROLE_LABEL } from "../../app/nav";
import { useDataset } from "../../data/load";
import { timeAgo } from "../../lib/format";
import { applyTheme, setRole, updateWorkspace, useWorkspace, type Role } from "../../state/store";
import { ErrorBoundary } from "../ErrorBoundary";
import { Logo } from "../Logo";
import { Badge, cn, Kbd, LoadingBlock, Segmented, Toaster } from "../ui";
import { CommandPalette } from "./CommandPalette";
import { Onboarding } from "./Onboarding";

export function AppShell() {
  const role = useWorkspace((w) => w.role);
  const onboarded = useWorkspace((w) => w.onboarded);
  const theme = useWorkspace((w) => w.theme);
  const hasKey = useWorkspace((w) => !!w.ai.apiKey);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    updateWorkspace((w) => {
      w.theme = next;
    });
    applyTheme(next);
  };

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="no-print sticky top-0 hidden h-screen w-[264px] shrink-0 border-r border-line bg-surface lg:block">
        <Sidebar role={role} />
      </aside>
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-[280px] border-r border-line bg-surface shadow-pop">
            <button className="absolute top-3 right-3 rounded-md p-1.5 text-ink-3 hover:bg-surface-2" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="size-4" />
            </button>
            <Sidebar role={role} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-page/85 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-[13.5px] text-ink-3 shadow-card hover:border-line-strong sm:max-w-md"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search tools or ask a question</span>
            <span className="ml-auto hidden sm:inline">
              <Kbd>⌘K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <Link to="/app/settings" className="hidden sm:block" title={hasKey ? "Claude is connected" : "Using the built-in analyst. Add an API key in Settings to use Claude."}>
              <Badge tone={hasKey ? "brand" : "neutral"} icon={<Sparkles className="size-3.5" />}>
                {hasKey ? "Claude connected" : "Built-in analyst"}
              </Badge>
            </Link>
            <button onClick={toggleTheme} className="rounded-md p-2 text-ink-2 hover:bg-surface-2" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<LoadingBlock label="Loading…" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {!onboarded && <Onboarding />}
      <Toaster />
    </div>
  );
}

function Sidebar({ role }: { role: Role }) {
  const manifest = useDataset("manifest");
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-3">
        <Link to="/" className="inline-flex">
          <Logo />
        </Link>
        <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <div className="text-[12px] text-ink-3">Workspace</div>
          <div className="text-[13.5px] font-semibold text-ink">New York City</div>
        </div>
        <Segmented<Role>
          className="mt-3 w-full [&>button]:flex-1"
          size="sm"
          value={role}
          onChange={setRole}
          options={[
            { value: "budget", label: ROLE_LABEL.budget },
            { value: "council", label: ROLE_LABEL.council },
          ]}
        />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {NAV_BY_ROLE[role].map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-4")}>
            {group.label && <div className="px-2 pb-1 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">{group.label}</div>}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/app"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[13.5px] font-medium transition-colors",
                    isActive ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )
                }
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-4 py-3 text-[12px] text-ink-3">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-good" />
          NYC Open Data · refreshed {timeAgo(manifest.data?.updatedAt)}
        </div>
      </div>
    </div>
  );
}

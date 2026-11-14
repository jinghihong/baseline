// Frame for the public pages: landing, research brief, methodology.
import { ArrowRight, Moon, Sun } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { REPO_URL } from "../../app/config";
import { applyTheme, updateWorkspace, useWorkspace } from "../../state/store";
import { Logo } from "../Logo";
import { ButtonLink, cn, Toaster } from "../ui";

const LINKS = [
  { to: "/#product", label: "Product" },
  { to: "/brief", label: "Research" },
  { to: "/methodology", label: "Methodology" },
];

export function PublicLayout() {
  const theme = useWorkspace((w) => w.theme);
  const dark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="no-print sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" aria-label="Baseline home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => cn("rounded-md px-3 py-1.5 text-[14px] text-ink-2 hover:text-ink", isActive && l.to !== "/#product" && "text-ink")}>
                {l.label}
              </NavLink>
            ))}
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="rounded-md px-3 py-1.5 text-[14px] text-ink-2 hover:text-ink">
              GitHub
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                const next = dark ? "light" : "dark";
                updateWorkspace((w) => {
                  w.theme = next;
                });
                applyTheme(next);
              }}
              className="rounded-md p-2 text-ink-2 hover:bg-surface-2"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <ButtonLink to="/app" variant="primary" icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
              Open the app
            </ButtonLink>
          </div>
        </div>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
      <footer className="no-print border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-[13.5px] text-ink-3 sm:grid-cols-3 sm:px-6">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs">One set of numbers for the budget office and the council. Built on the city's own open data.</p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-ink">Product</span>
            <Link to="/app" className="hover:text-ink">Open the app</Link>
            <Link to="/brief" className="hover:text-ink">Research brief</Link>
            <Link to="/methodology" className="hover:text-ink">How the forecasts work</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-ink">Data</span>
            <a href="https://opendata.cityofnewyork.us/" target="_blank" rel="noreferrer" className="hover:text-ink">NYC Open Data</a>
            <a href="https://www.grants.gov/" target="_blank" rel="noreferrer" className="hover:text-ink">Grants.gov</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">Source code</a>
          </div>
        </div>
        <div className="border-t border-line py-4 text-center text-[12px] text-ink-3">Baseline is an independent project. It is not affiliated with the City of New York.</div>
      </footer>
      <Toaster />
    </div>
  );
}

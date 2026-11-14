import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { AppShell } from "./components/layout/AppShell";
import { PublicLayout } from "./components/layout/PublicLayout";
import { LoadingBlock } from "./components/ui";

const Landing = lazy(() => import("./pages/Landing"));
const Brief = lazy(() => import("./pages/Brief"));
const Methodology = lazy(() => import("./pages/Methodology"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Home = lazy(() => import("./pages/app/Home"));
const Forecaster = lazy(() => import("./pages/app/Forecaster"));
const Watchlist = lazy(() => import("./pages/app/Watchlist"));
const ProjectDetail = lazy(() => import("./pages/app/ProjectDetail"));
const Maintenance = lazy(() => import("./pages/app/Maintenance"));
const Debt = lazy(() => import("./pages/app/Debt"));
const SecondOpinion = lazy(() => import("./pages/app/SecondOpinion"));
const Overtime = lazy(() => import("./pages/app/Overtime"));
const SpendTracker = lazy(() => import("./pages/app/SpendTracker"));
const Scenarios = lazy(() => import("./pages/app/Scenarios"));
const Hearings = lazy(() => import("./pages/app/Hearings"));
const FiscalNotes = lazy(() => import("./pages/app/FiscalNotes"));
const District = lazy(() => import("./pages/app/District"));
const Demand = lazy(() => import("./pages/app/Demand"));
const Grants = lazy(() => import("./pages/app/Grants"));
const Ask = lazy(() => import("./pages/app/Ask"));
const Reports = lazy(() => import("./pages/app/Reports"));
const Data = lazy(() => import("./pages/app/Data"));
const Settings = lazy(() => import("./pages/app/Settings"));

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <ScrollToTop />
      <Suspense fallback={<LoadingBlock className="min-h-screen" label="Loading Baseline…" />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="brief" element={<Brief />} />
            <Route path="methodology" element={<Methodology />} />
          </Route>
          <Route path="app" element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="forecaster" element={<Forecaster />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="watchlist/:id" element={<ProjectDetail />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="debt" element={<Debt />} />
            <Route path="second-opinion" element={<SecondOpinion />} />
            <Route path="overtime" element={<Overtime />} />
            <Route path="spend-tracker" element={<SpendTracker />} />
            <Route path="scenarios" element={<Scenarios />} />
            <Route path="hearings" element={<Hearings />} />
            <Route path="fiscal-notes" element={<FiscalNotes />} />
            <Route path="district" element={<District />} />
            <Route path="demand" element={<Demand />} />
            <Route path="grants" element={<Grants />} />
            <Route path="ask" element={<Ask />} />
            <Route path="reports" element={<Reports />} />
            <Route path="data" element={<Data />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route element={<PublicLayout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// Grant finder: open federal funding that city governments can apply for, matched to the city's capital projects.
import { CalendarClock, Download, ExternalLink, HandCoins, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Section,
  Segmented,
  Select,
  SourceNote,
  Stat,
  StatGrid,
  Toggle,
  downloadFile,
  toCsv,
  type Tone,
} from "../../components/ui";
import { useDatasets } from "../../data/load";
import {
  DEFAULT_FILTERS,
  buildClassIndex,
  daysUntil,
  filterGrants,
  grantKind,
  loadSaved,
  matchProjects,
  sortGrants,
  storeSaved,
  urgency,
  type GrantFilters,
} from "../../engines/grants";
import { date, money, num, timeAgo } from "../../lib/format";

const PAGE = 25;
const URGENCY: Record<ReturnType<typeof urgency>, { tone: Tone; label: (d: number | null) => string }> = {
  closing: { tone: "bad", label: (d) => (d === 0 ? "Closes today" : `Closes in ${d} day${d === 1 ? "" : "s"}`) },
  soon: { tone: "warn", label: (d) => `Closes in ${d} days` },
  open: { tone: "neutral", label: (d) => `${d} days left` },
  unknown: { tone: "neutral", label: () => "No deadline listed" },
};

export default function Grants() {
  const { data, error, loading } = useDatasets(["grants", "capital"]);
  const [filters, setFilters] = useState<GrantFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<"relevance" | "deadline" | "newest">("relevance");
  const [saved, setSaved] = useState<string[]>(() => loadSaved());
  const [page, setPage] = useState(0);
  const savedSet = useMemo(() => new Set(saved), [saved]);

  const model = useMemo(() => {
    if (!data) return null;
    const { grants, capital } = data;
    const classIndex = buildClassIndex(capital.projects);
    const programs = grants.opportunities.filter((o) => grantKind(o) === "program");
    const agencies = [...new Set(grants.opportunities.map((o) => o.agency))].sort();
    return { grants, classIndex, programs, agencies };
  }, [data]);

  const results = useMemo(() => {
    if (!model) return [];
    return sortGrants(filterGrants(model.grants.opportunities, filters, savedSet), sort);
  }, [model, filters, savedSet, sort]);

  if (loading) return <LoadingBlock label="Loading open grants…" />;
  if (error || !model) return <ErrorBlock error={error ?? "No data"} />;

  const set = (patch: Partial<GrantFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };
  const toggleSaved = (id: string) => {
    const next = savedSet.has(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    storeSaved(next);
  };
  const closing30 = model.programs.filter((o) => {
    const d = daysUntil(o.closeDate);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const themes = model.grants.meta.themes;
  const visible = results.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(results.length / PAGE));

  const exportCsv = () =>
    downloadFile(
      "baseline-grants.csv",
      toCsv(
        results.map((o) => ({
          title: o.title,
          number: o.number,
          agency: o.agency,
          status: o.status,
          open_date: o.openDate ?? "",
          close_date: o.closeDate ?? "",
          themes: o.themes.join("; "),
          assistance_listings: o.aln.join("; "),
          url: o.url,
        })),
      ),
      "text/csv",
    );

  return (
    <>
      <PageHeader
        eyebrow="Funding"
        title="Grant finder"
        description="Federal funding that city governments are eligible for, matched to the kinds of projects in the city's capital plan. Research and overseas awards are hidden unless you ask for them."
        actions={
          <Button icon={<Download className="size-4" />} onClick={exportCsv} disabled={!results.length}>
            Export CSV
          </Button>
        }
      />

      <StatGrid cols={4}>
        <Stat label="Program grants open to cities" value={num(model.programs.length)} detail="Posted or forecasted on Grants.gov" />
        <Stat label="Closing within 30 days" value={num(closing30)} detail="Program grants only" tone={closing30 ? "warn" : "neutral"} />
        <Stat label="Saved" value={num(saved.length)} detail="Kept in this browser" />
        <Stat label="Data refreshed" value={timeAgo(model.grants.meta.fetchedAt)} detail="Updated weekly from Grants.gov" />
      </StatGrid>

      <Card className="mt-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" htmlFor="g-q">
            <Input id="g-q" placeholder="Title, agency or number" value={filters.query} onChange={(e) => set({ query: e.target.value })} />
          </Field>
          <Field label="Theme" htmlFor="g-theme">
            <Select id="g-theme" value={filters.theme} onChange={(e) => set({ theme: e.target.value })}>
              <option value="">All themes</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Federal agency" htmlFor="g-agency">
            <Select id="g-agency" value={filters.agency} onChange={(e) => set({ agency: e.target.value })}>
              <option value="">All agencies</option>
              {model.agencies.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Closing within" htmlFor="g-close">
            <Select id="g-close" value={filters.closingWithin ?? ""} onChange={(e) => set({ closingWithin: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Any time</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Segmented
            size="sm"
            value={filters.status}
            onChange={(v) => set({ status: v })}
            options={[
              { value: "all", label: "All" },
              { value: "posted", label: "Posted" },
              { value: "forecasted", label: "Forecasted" },
            ]}
          />
          <Toggle checked={filters.includeResearch} onChange={(v) => set({ includeResearch: v })} label="Include research grants" />
          <Toggle checked={filters.savedOnly} onChange={(v) => set({ savedOnly: v })} label="Saved only" />
          <div className="ml-auto flex items-center gap-2 text-[13px] text-ink-3">
            Sort
            <Select className="h-8 w-36" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort grants">
              <option value="relevance">Most relevant</option>
              <option value="deadline">Closing soonest</option>
              <option value="newest">Newest</option>
            </Select>
          </div>
        </div>
      </Card>

      <Section className="mt-6" title={`${num(results.length)} opportunit${results.length === 1 ? "y" : "ies"}`} description="Relevance favors program grants with city-related titles. Always confirm eligibility on Grants.gov.">
        {visible.length === 0 ? (
          <EmptyState icon={<HandCoins className="size-6" />} title="No grants match these filters" action={<Button onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</Button>}>
            Try a wider deadline window or turn on research grants.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((o) => {
              const days = daysUntil(o.closeDate);
              const u = URGENCY[urgency(days)];
              const match = matchProjects(o, themes, model.classIndex);
              const isSaved = savedSet.has(o.id);
              const kind = grantKind(o);
              return (
                <Card key={o.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <a href={o.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1.5 text-[15px] font-semibold text-ink hover:text-brand">
                        <span>{o.title}</span>
                        <ExternalLink className="mt-1 size-3.5 shrink-0 text-ink-3 group-hover:text-brand" />
                      </a>
                      <div className="mt-1 text-[13px] text-ink-3">
                        {o.agency} · {o.number}
                        {o.aln.length ? ` · Assistance listing ${o.aln.slice(0, 2).join(", ")}` : ""}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={u.tone} icon={<CalendarClock className="size-3.5" />}>
                          {days !== null && days < 0 ? "Closed" : u.label(days)}
                        </Badge>
                        <Badge tone={o.status === "posted" ? "good" : "neutral"}>{o.status === "posted" ? "Posted" : "Forecasted"}</Badge>
                        {kind === "research" && <Badge>Research</Badge>}
                        {o.themes.map((t) => (
                          <Badge key={t} tone="brand">
                            {themes.find((x) => x.id === t)?.label ?? t}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-2.5 text-[12.5px] text-ink-3">
                        {o.closeDate ? `Applications due ${date(o.closeDate)}` : "No close date listed"}
                        {o.openDate ? ` · opened ${date(o.openDate)}` : ""}
                        {match.projects > 0 && (
                          <>
                            {" · "}
                            <Link to={`/app/watchlist?cls=${encodeURIComponent(match.classes[0])}`} className="font-medium text-brand hover:underline">
                              Could support {num(match.projects)} capital projects ({money(match.budget)})
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSaved(o.id)}
                      aria-pressed={isSaved}
                      aria-label={isSaved ? `Remove ${o.title} from saved` : `Save ${o.title}`}
                      className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                    >
                      <Star className={isSaved ? "size-5 fill-[var(--warn)] text-[var(--warn)]" : "size-5"} />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-[13px] text-ink-3">
            <span>
              Page {page + 1} of {pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Callout tone="neutral" title="How matching works">
        Each opportunity is tagged with themes from its title (for example "bridge" or "stormwater"). Each theme maps to asset classes in the capital plan, so the project count shows how many watchlist projects are the kind of work the grant
        funds. It is a starting point for a grants team, not an eligibility check.
        <SourceNote href="https://www.grants.gov/" className="mt-2 block">
          Source: Grants.gov Search API, opportunities where city or township governments are eligible.
        </SourceNote>
      </Callout>
    </>
  );
}

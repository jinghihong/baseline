// District view: one Council district's capital awards, its 311 demand against the average district,
// and the riskiest capital projects in its borough.
import { ArrowRight, MapPin } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { RankedBars, TimeSeriesChart } from "../../components/charts";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Delta,
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  Section,
  Select,
  SourceNote,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
  type RiskLevel,
} from "../../components/ui";
import { agencyName } from "../../data/agencies";
import { useDatasets } from "../../data/load";
import { assessAllProjects, uniqueBudgets } from "../../engines/core";
import { DISTRICTS, awardsForDistrict, demandYears, districtBorough, districtDemand, likelyMember, summarizeAwards } from "../../engines/district";
import { money, num, pct } from "../../lib/format";
import { updateWorkspace, useWorkspace } from "../../state/store";

const LEVEL_RANK: Record<RiskLevel, number> = { critical: 3, high: 2, watch: 1, low: 0 };

export default function District() {
  const stored = useWorkspace((w) => w.council.district);
  const district = stored ?? 1;
  const { data, error, loading } = useDatasets(["council", "demand", "capital"]);

  const model = useMemo(() => {
    if (!data) return null;
    const fys = data.council.meta.fiscalYears;
    const latestFy = fys[fys.length - 1];
    const awards = awardsForDistrict(data.council.awards, district);
    const summary = summarizeAwards(awards, fys);
    const member = likelyMember(awards, latestFy);
    // Use the latest full calendar year of 311 data; the current year is still in progress.
    const years = demandYears(data.demand);
    const thisYear = new Date().getFullYear();
    const year = years.filter((y) => y < thisYear).at(-1) ?? years.at(-1) ?? thisYear - 1;
    const demand = districtDemand(data.demand, district, year);
    const borough = districtBorough(district);
    const projects = uniqueBudgets(assessAllProjects(data.capital).filter((a) => a.project.boro === borough))
      .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.growth - a.growth)
      .slice(0, 10);
    return { fys, latestFy, awards, summary, member, year, demand, borough, projects };
  }, [data, district]);

  const setDistrict = (d: number) =>
    updateWorkspace((w) => {
      w.council.district = d;
    });

  if (loading) return <LoadingBlock label="Loading district data…" />;
  if (error || !model) return <ErrorBlock error={error ?? "No data"} />;

  const latest = model.summary.byFy.at(-1);
  const totalDemand = model.demand.reduce((s, r) => s + r.district, 0);
  const avgDemand = model.demand.reduce((s, r) => s + r.average, 0);

  return (
    <>
      <PageHeader
        eyebrow="Your district"
        title={`Council District ${district}`}
        description={`${model.borough}${model.member ? ` · capital awards most often sponsored by ${model.member}` : ""}. Where the district's capital money goes, what residents report to 311, and which projects in the borough are slipping.`}
        actions={
          <Field label="District" htmlFor="district-pick" className="w-60">
            <Select id="district-pick" value={district} onChange={(e) => setDistrict(Number(e.target.value))}>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  District {d} · {districtBorough(d)}
                </option>
              ))}
            </Select>
          </Field>
        }
      />

      <StatGrid cols={4}>
        <Stat label={`Capital awards, ${latest?.fy ?? "latest year"}`} value={money(latest?.total ?? 0)} detail={`${num(latest?.count ?? 0)} awards`} />
        <Stat label={`Awards, ${model.fys[0]}–${model.latestFy}`} value={money(model.summary.total)} detail={`${num(model.summary.count)} awards over ${model.fys.length} years`} />
        <Stat
          label={`311 requests, ${model.year}`}
          value={num(totalDemand)}
          detail={avgDemand ? `${pct(totalDemand / avgDemand - 1, { sign: true })} vs the average district` : undefined}
          tone={avgDemand && totalDemand > avgDemand * 1.15 ? "serious" : "neutral"}
        />
        <Stat label={`Riskiest projects in ${model.borough}`} value={num(model.projects.filter((p) => p.level === "critical").length)} detail="critical among the top 10 shown below" tone="bad" />
      </StatGrid>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Capital awards by year" subtitle="Discretionary capital allocated to this district, including shared awards" />
          <CardBody>
            <TimeSeriesChart
              data={model.summary.byFy.map((y) => ({ fy: y.fy, total: y.total }))}
              xKey="fy"
              series={[{ key: "total", label: "Awarded", slot: 0, kind: "bar" }]}
              yFormat={(v) => money(v)}
              height={220}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Where the money goes" subtitle={`All awards ${model.fys[0]}–${model.latestFy}, by budget line type`} />
          <CardBody>
            {model.summary.byCategory.length ? (
              <RankedBars rows={model.summary.byCategory.slice(0, 8).map((c) => ({ id: c.category, label: c.category, sublabel: `${c.count} awards`, value: c.total }))} format={(v) => money(v)} />
            ) : (
              <p className="text-[13.5px] text-ink-3">No awards recorded for this district.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Section className="mt-8" title="Largest awards" description="Shared awards are joint allocations with other members or a borough delegation.">
        {model.awards.length ? (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Year</Th>
                  <Th>Type</Th>
                  <Th>Sponsor</Th>
                  <Th align="right">Award</Th>
                </tr>
              </thead>
              <tbody>
                {model.awards.slice(0, 12).map((a, i) => (
                  <tr key={`${a.title}-${a.fy}-${i}`}>
                    <Td className="max-w-[340px]">
                      <div className="truncate font-medium text-ink" title={a.title}>
                        {a.title}
                      </div>
                      {a.shared && <Badge className="mt-0.5">Shared</Badge>}
                    </Td>
                    <Td>{a.fy}</Td>
                    <Td>{a.category}</Td>
                    <Td className="max-w-[200px] truncate">{a.sponsor ?? "—"}</Td>
                    <Td align="right" className="font-medium text-ink">
                      {money(a.award)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : (
          <EmptyState icon={<MapPin className="size-6" />} title="No awards found">
            The Council capital dataset has no allocations coded to this district in these years.
          </EmptyState>
        )}
        <SourceNote href="https://data.cityofnewyork.us/d/t474-a92g" className="mt-2">
          NYC Open Data: City Council Capital Budget.
        </SourceNote>
      </Section>

      <Section title={`What residents reported to 311 in ${model.year}`} description="Compared with the average of all 51 districts. An index of 1.5 means 50% more requests than a typical district.">
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Complaint type</Th>
                <Th>Agency</Th>
                <Th align="right">Requests</Th>
                <Th align="right">Average district</Th>
                <Th align="right">Index</Th>
                <Th align="right">vs {model.year - 1}</Th>
              </tr>
            </thead>
            <tbody>
              {model.demand.map((r) => (
                <tr key={r.type}>
                  <Td className="font-medium text-ink">{r.label}</Td>
                  <Td>{r.agency}</Td>
                  <Td align="right">{num(r.district)}</Td>
                  <Td align="right">{num(r.average)}</Td>
                  <Td align="right">
                    <span className={r.index >= 1.5 ? "font-semibold text-serious-ink" : r.index <= 0.67 ? "text-ink-3" : "text-ink"}>{r.index.toFixed(2)}×</span>
                  </Td>
                  <Td align="right">
                    <Delta value={r.change} format={(v) => pct(v)} goodWhen="none" />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <SourceNote href="https://data.cityofnewyork.us/d/erm2-nwe9" className="mt-2">
          NYC 311 Service Requests, counted by the Council district recorded on each request.
        </SourceNote>
      </Section>

      <Section
        title={`Capital projects to watch in ${model.borough}`}
        description="Ranked by risk, then by growth since the city first reported the budget."
        actions={
          <Link to={`/app/watchlist?boro=${encodeURIComponent(model.borough)}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
            Full borough list <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <Card>
          <ul className="divide-y divide-line">
            {model.projects.map((p) => (
              <li key={p.project.id}>
                <Link to={`/app/watchlist/${encodeURIComponent(p.project.id)}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{p.project.name}</span>
                    <span className="block text-[12.5px] text-ink-3">
                      {agencyName(p.project.agency)} · {money(p.project.firstBudget)} → {money(p.project.budget)}
                      {p.slipDays ? ` · ${Math.round(p.slipDays / 30.4)} months later than first forecast` : ""}
                    </span>
                  </span>
                  <RiskBadge level={p.level} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <SourceNote className="mt-2">Capital Projects Dashboard (NYC Open Data). Council districts don't appear in the capital data, so projects are shown for the district's borough.</SourceNote>
      </Section>
    </>
  );
}

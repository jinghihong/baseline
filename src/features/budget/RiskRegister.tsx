// The Comptroller's FY2027 review of the Mayor's financial plan, line by line. Published figures, $ millions.
import {
  FY27_COMPTROLLER_GAP,
  FY27_EXPENSE_RISKS,
  FY27_GAP_WITH_SAVINGS_RISK,
  FY27_OMB_GAP,
  FY27_REVENUE_DIFF,
  FY27_UNSUBSTANTIATED_SAVINGS,
  FY27_YEARS,
} from "../../data/curated";
import { fy, money } from "../../lib/format";
import { Badge, Card, CardHeader, Cite, cn, Table, Td, Th } from "../../components/ui";

const m = (v: number) => money(v * 1e6, { digits: v !== 0 && Math.abs(v) < 1000 ? 0 : undefined });

function Amount({ v, strong }: { v: number; strong?: boolean }) {
  if (v === 0) return <span className="text-ink-3">—</span>;
  return <span className={cn("tabular", v < 0 ? "text-bad-ink" : "text-good-ink", strong && "font-semibold")}>{m(v)}</span>;
}

export function RiskRegister() {
  const expenseTotals = FY27_YEARS.map((_, i) => FY27_EXPENSE_RISKS.reduce((s, r) => s + r.values[i], 0));
  return (
    <Card>
      <CardHeader
        title="The Comptroller's review of the FY2027 plan"
        subtitle="Where the Comptroller's forecast differs from the Mayor's budget office (OMB), in dollars. Red adds to the gap; green narrows it."
        actions={<Cite id="fy27Adopted" />}
      />
      <Table>
        <thead>
          <tr>
            <Th>Item</Th>
            {FY27_YEARS.map((y) => (
              <Th key={y} align="right">
                {fy(y)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FY27_EXPENSE_RISKS.map((r) => (
            <tr key={r.id}>
              <Td>
                <span className="text-ink">{r.label}</span>
                {r.kind === "offset" && (
                  <Badge tone="good" className="ml-2">
                    Offset
                  </Badge>
                )}
              </Td>
              {r.values.map((v, i) => (
                <Td key={i} align="right">
                  <Amount v={v} />
                </Td>
              ))}
            </tr>
          ))}
          <tr className="bg-surface-2/60">
            <Td className="font-semibold text-ink">Spending differences, total</Td>
            {expenseTotals.map((v, i) => (
              <Td key={i} align="right">
                <Amount v={v} strong />
              </Td>
            ))}
          </tr>
          <tr>
            <Td className="text-ink">Revenue: Comptroller forecast above OMB</Td>
            {FY27_REVENUE_DIFF.total.map((v, i) => (
              <Td key={i} align="right">
                <Amount v={v} />
              </Td>
            ))}
          </tr>
          <tr className="border-t-2 border-line-strong">
            <Td className="text-ink">Gap in OMB's financial plan</Td>
            {FY27_OMB_GAP.map((v, i) => (
              <Td key={i} align="right">
                <Amount v={v} />
              </Td>
            ))}
          </tr>
          <tr className="bg-brand-soft/60">
            <Td className="font-semibold text-ink">Gap, restated by the Comptroller</Td>
            {FY27_COMPTROLLER_GAP.map((v, i) => (
              <Td key={i} align="right">
                <Amount v={v} strong />
              </Td>
            ))}
          </tr>
          <tr>
            <Td className="text-ink-2">Risk that unspecified savings don't happen</Td>
            {FY27_UNSUBSTANTIATED_SAVINGS.map((v, i) => (
              <Td key={i} align="right">
                <Amount v={v} />
              </Td>
            ))}
          </tr>
          <tr>
            <Td className="text-ink-2">Gap including that risk</Td>
            {FY27_GAP_WITH_SAVINGS_RISK.map((v, i) => (
              <Td key={i} align="right">
                <Amount v={v} />
              </Td>
            ))}
          </tr>
        </tbody>
      </Table>
      <p className="px-5 py-3 text-[12.5px] text-ink-3">
        Figures are the Comptroller's, from Table 4 of its comments on the FY2027 Adopted Budget, rounded to the nearest million. Baseline does not change them.
      </p>
    </Card>
  );
}

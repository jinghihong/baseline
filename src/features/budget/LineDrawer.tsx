// Detail view for one budget line: adopted vs end-of-year budget, year by year, with a plain reading.
import { Copy } from "lucide-react";
import { TimeSeriesChart } from "../../components/charts";
import { Button, Callout, copyText, Drawer, RiskBadge, SourceNote, Table, Td, Th } from "../../components/ui";
import type { LineAssessment } from "../../engines/core";
import { lineAgency, lineReading, objectClassLabel } from "../../engines/budgetRisk";
import { fy, money, pct } from "../../lib/format";

export function LineDrawer({ item, onClose, sourceUrl }: { item: LineAssessment | null; onClose: () => void; sourceUrl?: string }) {
  if (!item) return null;
  const rows = item.line.years.map((y) => ({ fy: y.fy, adopted: y.adopted, modified: y.modified }));
  const question = `${lineAgency(item)}, ${objectClassLabel(item.line.objectClass).toLowerCase()}: adopted at ${money(item.latestAdopted)} for ${fy(item.latestAdoptedFy)}, but it ended ${item.yearsOver} of the last ${item.yearsAssessed} years above adoption. What is the realistic year-end figure, and how much of past growth came from new grants versus spending the budget did not plan for?`;
  return (
    <Drawer open={!!item} onClose={onClose} title={objectClassLabel(item.line.objectClass)} subtitle={lineAgency(item)}>
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge level={item.level} label={item.technical ? "Technical line" : undefined} />
        {item.chronic && <span className="text-[13px] text-ink-3">Chronic: ends above adoption most years</span>}
      </div>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{lineReading(item)}</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line p-3">
          <div className="text-[12px] text-ink-3">Typical year-end vs adopted</div>
          <div className="mt-1 text-lg font-semibold text-ink">{pct(item.medianRatio - 1, { sign: true })}</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-[12px] text-ink-3">Years 5%+ above</div>
          <div className="mt-1 text-lg font-semibold text-ink">
            {item.yearsOver} of {item.yearsAssessed}
          </div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-[12px] text-ink-3">Expected growth {fy(item.latestAdoptedFy)}</div>
          <div className="mt-1 text-lg font-semibold text-ink">{money(item.expectedIncrease)}</div>
          <div className="text-[11.5px] text-ink-3">Estimate</div>
        </div>
      </div>

      <div className="mt-6">
        <TimeSeriesChart
          title="Adopted vs end-of-year budget"
          subtitle="The end-of-year figure is the budget after every change made during the year."
          data={rows}
          xKey="fy"
          xFormat={(v) => fy(Number(v))}
          yFormat={(v) => money(v)}
          series={[
            { key: "adopted", label: "Adopted", slot: 0 },
            { key: "modified", label: "End of year", slot: 1 },
          ]}
          height={240}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <Table>
          <thead>
            <tr>
              <Th>Fiscal year</Th>
              <Th align="right">Adopted</Th>
              <Th align="right">End of year</Th>
              <Th align="right">Change</Th>
            </tr>
          </thead>
          <tbody>
            {item.years.map((y) => (
              <tr key={y.fy}>
                <Td>{fy(y.fy)}</Td>
                <Td align="right">{money(y.adopted)}</Td>
                <Td align="right">{money(y.modified)}</Td>
                <Td align="right" className={y.ratio >= 1.05 ? "text-bad-ink" : y.ratio <= 0.95 ? "text-good-ink" : undefined}>
                  {pct(y.ratio - 1, { sign: true })}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Callout tone="warn" className="mt-6" title="Read with care">
        A budget can grow during the year because the city recognizes new state or federal grants, not only because the adopted amount was too low. Ask how much of the change was outside money.
      </Callout>

      <div className="mt-6 rounded-xl border border-line bg-surface-2 p-4">
        <div className="mb-1.5 text-[13px] font-semibold text-ink">Question for the hearing</div>
        <p className="text-[14px] text-ink-2">{question}</p>
        <Button size="sm" className="mt-3" icon={<Copy className="size-3.5" />} onClick={() => copyText(question, "Question copied")}>
          Copy question
        </Button>
      </div>

      <SourceNote href={sourceUrl} className="mt-5">
        NYC Open Data, Expense Budget (adopted budget publications, all funds).
      </SourceNote>
    </Drawer>
  );
}

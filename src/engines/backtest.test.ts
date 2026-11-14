import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BacktestData, BacktestProject } from "../data/types";
import { runBacktest } from "./backtest";

const project = (id: string, orig: number, current: number, cls = "parks"): BacktestProject => ({ id, name: id, agency: "DPR", cls, boro: "Queens", orig, current });

describe("runBacktest (synthetic)", () => {
  it("scores where each finished project landed against its forecast range", () => {
    // Training: half the projects finish on budget, half at 1.5x.
    const train = Array.from({ length: 200 }, (_, i) => project(`t${i}`, 5e6, i % 2 ? 7.5e6 : 5e6));
    const test = [project("a", 5e6, 5e6), project("b", 5e6, 7.5e6), project("c", 5e6, 30e6)];
    const data: BacktestData = { meta: { fetchedAt: "", sources: [], trainingPub: "2019-04-25", lastPub: "2023-10-26", publications: [], doneThreshold: 0.8 }, train, test };
    const r = runBacktest(data);
    expect(r.n).toBe(3);
    expect(r.trainingSize).toBe(200);
    expect(r.originalHeld).toBeCloseTo(1 / 3);
    expect(r.cases.find((c) => c.project.id === "c")?.band).toBe("above");
    expect(r.worstMisses[0].project.id).toBe("c");
    expect(r.coverage.map((c) => c.label)).toEqual(["P50", "P80", "P90"]);
  });
});

// Runs the real out-of-sample backtest on the NYC snapshot when it is present.
const file = join(process.cwd(), "public", "data", "backtest.json");
describe.runIf(existsSync(file))("runBacktest (NYC data)", () => {
  it("is out of sample and reasonably calibrated", () => {
    const data = JSON.parse(readFileSync(file, "utf8")) as BacktestData;
    const trainIds = new Set(data.train.map((p) => p.id));
    expect(data.test.some((p) => trainIds.has(p.id))).toBe(false); // no look-ahead
    const r = runBacktest(data);
    console.log(
      `[backtest] n=${r.n} trained on ${r.trainingSize} (${r.trainingPub}) coverage ` +
        r.coverage.map((c) => `${c.label} ${(c.actual * 100).toFixed(0)}% (target ${c.target * 100}%)`).join(", ") +
        ` | original budget held ${(r.originalHeld * 100).toFixed(0)}%, P80 held ${(r.p80Held * 100).toFixed(0)}%, median final ratio ${r.medianFinalRatio.toFixed(2)}, median P80 contingency ${(r.medianContingency * 100).toFixed(0)}%`,
    );
    expect(r.n).toBeGreaterThan(200);
    // The recommended P80 budget must hold far more often than the city's original estimate.
    expect(r.p80Held).toBeGreaterThan(r.originalHeld);
    // Coverage must rise with the percentile.
    expect(r.coverage[0].actual).toBeLessThanOrEqual(r.coverage[1].actual);
    expect(r.coverage[1].actual).toBeLessThanOrEqual(r.coverage[2].actual);
  });
});

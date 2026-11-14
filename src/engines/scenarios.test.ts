import { describe, expect, it } from "vitest";
import { baseInputs, decodeInputs, encodeInputs, presetInputs, runScenario } from "./scenarios";
import { FY27_COMPTROLLER_GAP, FY27_OMB_GAP } from "../data/curated";

describe("runScenario", () => {
  it("the OMB preset reproduces OMB's published gaps", () => {
    const r = runScenario(presetInputs("omb"));
    expect(r.scenario).toEqual([...FY27_OMB_GAP]);
    expect(r.contributions).toHaveLength(0);
    expect(r.totalChange).toBe(0);
  });

  it("the Comptroller preset reproduces the Comptroller's restated gaps within rounding", () => {
    const r = runScenario(presetInputs("comptroller"));
    r.scenario.forEach((v, i) => expect(Math.abs(v - FY27_COMPTROLLER_GAP[i])).toBeLessThanOrEqual(1));
  });

  it("a recession widens out-year gaps but not FY27", () => {
    const comptroller = runScenario(presetInputs("comptroller"));
    const recession = runScenario(presetInputs("recession"));
    expect(recession.scenario[0]).toBeCloseTo(comptroller.scenario[0]);
    expect(recession.scenario[1]).toBeLessThan(comptroller.scenario[1] - 4000);
    expect(recession.scenario[3]).toBeLessThan(comptroller.scenario[3]);
    expect(recession.scenario[3]).toBeGreaterThan(recession.scenario[2] - 10000);
  });

  it("uses Baseline's overtime estimate in place of the Comptroller's when chosen", () => {
    const inputs = { ...presetInputs("comptroller", 900), overtimeMode: "baseline" as const };
    const r = runScenario(inputs);
    const ot = r.contributions.find((c) => c.id === "overtime");
    expect(ot?.values).toEqual([-900, -900, -900, -900]);
    expect(ot?.source).toBe("baseline");
  });

  it("labor settlements compound from FY28", () => {
    const r = runScenario({ ...baseInputs(), laborPct: 2, payrollBaseM: 10000 });
    const labor = r.contributions.find((c) => c.id === "labor")!;
    expect(labor.values[0]).toBeCloseTo(0);
    expect(labor.values[1]).toBeCloseTo(-200);
    expect(labor.values[2]).toBeCloseTo(-404);
  });

  it("federal cuts start in the chosen year", () => {
    const r = runScenario({ ...baseInputs(), federalCutM: 500, federalStartFy: 2029 });
    expect(r.contributions.find((c) => c.id === "federal")?.values).toEqual([0, 0, -500, -500]);
  });
});

describe("encode / decode", () => {
  it("round-trips every lever", () => {
    const inputs = { ...presetInputs("federal", 750), taxPct: -1.5, laborPct: 1, savingsRisk: true, overtimeMode: "baseline" as const };
    const back = decodeInputs(encodeInputs(inputs), 750);
    expect(back).toEqual(inputs);
  });
});

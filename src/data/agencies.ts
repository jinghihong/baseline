import registry from "./agencies.json";

export interface AgencyInfo {
  code: string;
  name: string;
}

const byCode = new Map<string, AgencyInfo>(registry.map((a) => [a.code, { code: a.code, name: a.name }]));

export const AGENCIES: AgencyInfo[] = registry.map((a) => ({ code: a.code, name: a.name }));

/** Display name for an agency code; falls back to the code itself for agencies outside the registry. */
export function agencyName(code: string | null | undefined): string {
  if (!code) return "Unknown agency";
  return byCode.get(code)?.name ?? code;
}

export function isKnownAgency(code: string | null | undefined): boolean {
  return !!code && byCode.has(code);
}

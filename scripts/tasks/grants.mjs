// Open federal funding opportunities that city governments can apply for (Grants.gov Search2 API).
import { writeJson } from "../lib.mjs";

const THEMES = [
  { id: "transportation", label: "Streets, bridges & transit", keywords: ["transportation infrastructure", "bridge", "transit", "safe streets", "roadway safety"], classes: ["streets", "bridges", "lighting"] },
  { id: "water", label: "Water & sewer", keywords: ["water infrastructure", "wastewater", "stormwater", "drinking water"], classes: ["water", "sewers", "plants"] },
  { id: "resilience", label: "Resilience & hazard mitigation", keywords: ["hazard mitigation", "resilience", "flood", "climate adaptation"], classes: ["sewers", "waterfront", "parks"] },
  { id: "housing", label: "Housing & community development", keywords: ["affordable housing", "community development", "lead hazard", "homelessness"], classes: ["housing", "social"] },
  { id: "energy", label: "Energy & buildings", keywords: ["energy efficiency", "clean energy", "electric vehicle", "building decarbonization"], classes: ["facilities", "tech"] },
  { id: "safety", label: "Public safety & justice", keywords: ["law enforcement", "public safety", "emergency management", "violence prevention", "justice"], classes: ["safety", "justice"] },
  { id: "health", label: "Public health & human services", keywords: ["public health", "behavioral health", "opioid", "child care"], classes: ["social"] },
  { id: "parks", label: "Parks, culture & libraries", keywords: ["outdoor recreation", "urban forestry", "libraries", "arts"], classes: ["parks", "culture"] },
  { id: "digital", label: "Broadband & technology", keywords: ["broadband", "cybersecurity", "digital equity"], classes: ["tech"] },
  { id: "workforce", label: "Workforce & economic development", keywords: ["workforce development", "economic development", "brownfields", "small business"], classes: ["land"] },
];

async function search(keyword) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch("https://api.grants.gov/v1/api/search2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword, rows: 60, oppStatuses: "forecasted|posted", eligibilities: "02" }),
        signal: AbortSignal.timeout(60_000),
      });
      const body = await res.json();
      return body?.data?.oppHits ?? [];
    } catch (err) {
      console.log(`  … grants "${keyword}" attempt ${i + 1} failed (${err.message})`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return [];
}

// Grants.gov returns dates as MM/DD/YYYY.
const toIso = (d) => {
  const m = String(d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

export async function buildGrants() {
  console.log("• Grants.gov opportunities for city governments");
  const byId = new Map();
  for (const theme of THEMES) {
    for (const kw of theme.keywords) {
      const hits = await search(kw);
      for (const h of hits) {
        const id = String(h.id);
        const existing = byId.get(id);
        if (existing) {
          if (!existing.themes.includes(theme.id)) existing.themes.push(theme.id);
          continue;
        }
        byId.set(id, {
          id,
          number: h.number,
          title: h.title,
          agency: h.agencyName || h.agency || h.agencyCode,
          agencyCode: h.agencyCode,
          status: h.oppStatus,
          openDate: toIso(h.openDate),
          closeDate: toIso(h.closeDate),
          aln: Array.isArray(h.alnist) ? h.alnist : Array.isArray(h.cfdaList) ? h.cfdaList : [],
          themes: [theme.id],
          url: `https://www.grants.gov/search-results-detail/${id}`,
        });
      }
    }
    console.log(`  ✓ ${theme.id}: ${byId.size} unique so far`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const opportunities = [...byId.values()]
    .filter((o) => !o.closeDate || o.closeDate >= today)
    .sort((a, b) => (a.closeDate || "9999").localeCompare(b.closeDate || "9999"));
  writeJson("grants.json", {
    meta: {
      fetchedAt: new Date().toISOString(),
      note: "Posted and forecasted federal opportunities where city or township governments are eligible.",
      sources: [{ id: "grants-gov", title: "Grants.gov Search2 API", url: "https://www.grants.gov/api", publisher: "Grants.gov" }],
      themes: THEMES.map(({ id, label, classes }) => ({ id, label, classes })),
    },
    opportunities,
  });
}

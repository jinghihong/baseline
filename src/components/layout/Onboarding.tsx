// First visit: pick the workspace that matches your job. Everything else follows from the role.
import { Gavel, Landmark } from "lucide-react";
import { ROLE_LABEL, ROLE_TAGLINE } from "../../app/nav";
import { setRole, type Role } from "../../state/store";
import { LogoMark } from "../Logo";

const CHOICES: { role: Role; icon: typeof Gavel; points: string[] }[] = [
  {
    role: "budget",
    icon: Landmark,
    points: ["Price new capital projects from past results", "Catch lines that will run over before mid-year", "Rank repairs by risk, not by who asks loudest"],
  },
  {
    role: "council",
    icon: Gavel,
    points: ["A second opinion on every budget line", "Hearing briefs with questions backed by data", "Cost estimates for bills, and a view of your district"],
  },
];

export function Onboarding() {
  return (
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-8">
        <LogoMark className="size-9" />
        <h2 id="onboarding-title" className="mt-4 text-2xl font-semibold tracking-tight text-ink">
          Which side of the budget are you on?
        </h2>
        <p className="mt-1.5 text-[15px] text-ink-2">Both workspaces use the same numbers. You can switch at any time from the sidebar.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {CHOICES.map((c) => (
            <button
              key={c.role}
              type="button"
              onClick={() => setRole(c.role)}
              className="group flex flex-col rounded-xl border border-line bg-surface p-5 text-left transition hover:border-brand hover:shadow-pop focus-visible:border-brand"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <c.icon className="size-5" />
              </span>
              <span className="mt-3 text-[16px] font-semibold text-ink">{ROLE_LABEL[c.role]}</span>
              <span className="mt-1 text-[13.5px] text-ink-2">{ROLE_TAGLINE[c.role]}</span>
              <ul className="mt-3 space-y-1.5 text-[13px] text-ink-3">
                {c.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-brand" />
                    {p}
                  </li>
                ))}
              </ul>
              <span className="mt-4 text-[13.5px] font-semibold text-brand group-hover:underline">Open the {ROLE_LABEL[c.role].toLowerCase()} workspace →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

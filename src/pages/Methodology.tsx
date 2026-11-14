import { Database } from "lucide-react";
import methodology from "../../docs/methodology.md?raw";
import { ButtonLink, Card } from "../components/ui";
import { DocPage } from "../features/platform/DocPage";

export default function Methodology() {
  return (
    <DocPage
      source={methodology}
      filename="baseline-methodology.md"
      eyebrow="Methodology"
      aside={
        <Card className="p-4">
          <div className="text-[13px] font-semibold text-ink">Check the sources</div>
          <p className="mt-1 text-[12.5px] text-ink-3">See every dataset, when it was refreshed and how many rows it holds.</p>
          <ButtonLink to="/app/data" size="sm" className="mt-3 w-full" icon={<Database className="size-4" />}>
            Data & imports
          </ButtonLink>
        </Card>
      }
    />
  );
}

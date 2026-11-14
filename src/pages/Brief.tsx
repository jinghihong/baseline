import { ArrowRight } from "lucide-react";
import brief from "../../docs/research-brief.md?raw";
import { ButtonLink, Card } from "../components/ui";
import { DocPage } from "../features/platform/DocPage";

export default function Brief() {
  return (
    <DocPage
      source={brief}
      filename="baseline-research-brief.md"
      eyebrow="Research brief"
      aside={
        <Card className="p-4">
          <div className="text-[13px] font-semibold text-ink">See it on live data</div>
          <p className="mt-1 text-[12.5px] text-ink-3">Every figure in this brief comes from a tool you can open.</p>
          <ButtonLink to="/app" size="sm" variant="primary" className="mt-3 w-full" icon={<ArrowRight className="size-4" />}>
            Open the app
          </ButtonLink>
        </Card>
      }
    />
  );
}

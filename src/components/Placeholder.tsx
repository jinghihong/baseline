import { Construction } from "lucide-react";
import { EmptyState, PageHeader } from "./ui";

/** Temporary page body used while a feature is being built. */
export function Placeholder({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={<Construction className="size-6" />} title="Coming together">
        This view is being built.
      </EmptyState>
    </>
  );
}

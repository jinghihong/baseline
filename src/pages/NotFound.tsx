import { Compass } from "lucide-react";
import { ButtonLink, EmptyState } from "../components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <EmptyState icon={<Compass className="size-6" />} title="Page not found" action={<ButtonLink to="/app" variant="primary">Go to the app</ButtonLink>}>
        The link may be old, or the page may have moved.
      </EmptyState>
    </div>
  );
}

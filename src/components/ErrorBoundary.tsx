import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Callout } from "./ui";

interface Props {
  children: ReactNode;
  /** Changing this key resets the boundary (e.g., the current route). */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/** Keeps one broken screen from taking down the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Baseline screen error:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Callout tone="bad" title="This screen hit a problem">
          <p>{this.state.error.message || "An unexpected error occurred."}</p>
          <p className="mt-1">Your workspace is safe. Reload to try again, or pick another tool from the menu.</p>
          <Button className="mt-3" size="sm" icon={<RefreshCw className="size-3.5" />} onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Callout>
      </div>
    );
  }
}

import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage?: string;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown) {
    // Ensures we get a useful stack trace in dev/prod logs.
    console.error("App render error:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 container py-10">
          <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-background p-10 text-center">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The page couldn’t be rendered. Try going back to products.
            </p>
            {this.state.errorMessage ? (
              <pre className="mt-6 max-h-48 overflow-auto rounded-lg bg-muted p-4 text-left text-xs text-muted-foreground">
                {this.state.errorMessage}
              </pre>
            ) : null}
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/products">Back to Products</Link>
              </Button>
              <Button asChild>
                <Link to="/">Home</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
}

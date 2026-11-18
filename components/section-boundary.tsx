"use client";

import { Component, type ReactNode } from "react";
import { RouteError } from "@/components/route-error";

interface Props {
  children: ReactNode;
}

interface State {
  error: (Error & { digest?: string }) | null;
}

/** Keeps a failed section on this page instead of replacing the whole app. */
export class SectionBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <RouteError error={this.state.error} reset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

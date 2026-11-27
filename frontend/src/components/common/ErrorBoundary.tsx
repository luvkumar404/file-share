import { Component, type ErrorInfo, type ReactNode } from "react";

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    console.error("The application could not render.");
  }

  render() {
    if (this.state.failed) {
      return <main className="page-shell py-10" role="alert">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="my-4">Reload the page to try again.</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </main>;
    }
    return this.props.children;
  }
}

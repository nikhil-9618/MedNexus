import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <div className="card max-w-md p-8 text-center">
            <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-500">
              The interface hit an unexpected error. Your data is safe — reload to continue.
            </p>
            <button className="btn-primary mt-5" onClick={() => window.location.reload()}>
              Reload MedNexus
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

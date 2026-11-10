import React, { Component } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Pulsus React Error Boundary caught an error:', error, errorInfo);
    this.setState({
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.handleReset);
        }
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails } = this.state;

      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 md:p-8 text-center">
            <div className="w-16 h-16 mx-auto bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-5 ring-8 ring-rose-50/50 shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              Bir Hata Oluştu
            </h2>
            <p className="text-sm md:text-base text-slate-600 leading-relaxed mb-6">
              Uygulama çalışırken beklenmeyen bir hata ile karşılaşıldı. Lütfen sayfayı yenilemeyi veya işlemi tekrar denemeyi deneyin.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm transition-all shadow-sm shadow-rose-200 active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Sayfayı Yenile
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Tekrar Dene
              </button>

              <a
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-sm transition-all active:scale-95"
              >
                <Home className="w-4 h-4" />
                Ana Sayfa
              </a>
            </div>

            {(error || errorInfo) && (
              <div className="border-t border-slate-100 pt-4 text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="inline-flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Teknik Hata Detayları</span>
                  {showDetails ? (
                    <ChevronUp className="w-4 h-4 ml-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-1" />
                  )}
                </button>

                {showDetails && (
                  <div className="mt-3 bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-64 border border-slate-800 space-y-2 select-text">
                    {error && (
                      <div className="text-rose-400 font-semibold break-all">
                        {error.toString()}
                      </div>
                    )}
                    {errorInfo?.componentStack && (
                      <pre className="text-slate-400 text-[11px] whitespace-pre-wrap font-mono">
                        {errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

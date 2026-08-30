import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// 错误边界：捕获渲染期异常，避免任何子组件崩溃导致整页白屏（#43）。
// 仅能捕获渲染/生命周期中的错误，无法捕获异步事件（如 html2canvas）；
// 这些异步错误已由各自 try/finally 处理。
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 仅记录到控制台，便于排查；不向用户暴露堆栈
    console.error('[ARH] Runtime error caught by ErrorBoundary:', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      // 错误页处于 React 树之外（main.tsx 中包在 Provider 外层），
      // 直接读 localStorage 取语言，默认英文（与全站默认一致）。
      let lang: 'en' | 'zh' = 'en';
      try { const s = localStorage.getItem('arh_lang'); if (s === 'en' || s === 'zh') lang = s; } catch {}
      const title = lang === 'en' ? 'SYSTEM FAULT' : '系统异常 // SYSTEM FAULT';
      const body = lang === 'en'
        ? 'An unexpected error occurred during assessment and the report could not be generated. This is usually transient — reloading should recover it.'
        : '鉴定过程遇到未预期错误，报告未能生成。这通常是瞬时故障，重新加载即可恢复。';
      const reload = lang === 'en' ? 'Reload' : '重新加载';
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 text-slate-900">
          <div className="w-full max-w-md text-center">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mx-auto mb-6" aria-hidden>
              <rect x="1" y="1" width="62" height="62" rx="13" fill="#0f172a" />
              <line x1="8" y1="32" x2="56" y2="32" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 4" />
              <line x1="32" y1="8" x2="32" y2="56" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 4" />
            </svg>
            <h1 className="text-2xl font-black mb-3 tracking-tight">{title}</h1>
            <p className="text-slate-600 mb-8 text-sm leading-relaxed">{body}</p>
            <button
              onClick={this.handleReload}
              className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold hover:bg-black transition-all active:scale-[0.97]"
            >
              {reload}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

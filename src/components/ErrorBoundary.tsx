import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
          <div className="bg-white p-6 rounded-2xl shadow-lg max-w-lg w-full border border-red-100">
            <h2 className="text-red-600 text-xl font-bold mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              ระบบพบข้อผิดพลาด (App Crashed)
            </h2>
            <p className="text-slate-700 mb-4 text-sm">
              เกิดข้อผิดพลาดบางอย่างขึ้นในระบบ หากคุณกำลังตั้งค่า Firebase โปรดตรวจสอบว่าคุณได้สร้าง <strong>Firestore Database</strong> ใน Firebase Console แล้วหรือยัง
            </p>
            <div className="bg-slate-100 p-4 rounded-lg text-xs text-red-500 overflow-auto whitespace-pre-wrap max-h-48 font-mono">
              {this.state.error?.message || "Unknown Error"}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-6 w-full px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium"
            >
              รีเฟรชหน้าเว็บ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

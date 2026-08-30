'use client';

import { ReactNode, useEffect, useState } from 'react';

// 可选简单密码门：仅当设置 NEXT_PUBLIC_SITE_PASSWORD 时启用。
// 注意：客户端校验，仅防误入，非真正安全。
const PASSWORD = process.env.NEXT_PUBLIC_SITE_PASSWORD;
const STORAGE_KEY = 'gw_access';

export function AccessGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!PASSWORD) {
      setOk(true);
      return;
    }
    setOk(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  if (!PASSWORD || ok) return <>{children}</>;
  if (ok === null) return null;

  return <GateForm expected={PASSWORD} onPass={() => setOk(true)} />;
}

function GateForm({ expected, onPass }: { expected: string; onPass: () => void }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (val === expected) {
      localStorage.setItem(STORAGE_KEY, '1');
      onPass();
    } else {
      setErr(true);
      setVal('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4">
        <h1 className="text-center font-serif text-xl text-ink tracking-wide">金价观象台</h1>
        <input
          type="password"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setErr(false);
          }}
          placeholder="请输入访问密码"
          className="w-full rounded-sm bg-surface px-3 py-2 text-sm text-ink outline-none ring-1 ring-line focus:ring-accent"
          autoFocus
        />
        {err && <p className="text-xs text-up">密码错误</p>}
        <button
          type="submit"
          className="press w-full rounded-sm bg-accent py-2 text-sm font-medium text-surface hover:opacity-90"
        >
          进入
        </button>
      </form>
    </div>
  );
}

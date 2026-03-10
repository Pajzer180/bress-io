'use client';

import { useState } from 'react';
import { Globe, CheckCircle, Loader2 } from 'lucide-react';

interface StepGscProps {
  connected: boolean;
  onConnect: () => void;
}

export function StepGsc({ connected, onConnect }: StepGscProps) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      onConnect();
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">Podepnij Google Search Console</h2>
        <p className="mt-3 text-xl text-zinc-400">
          Opcjonalny krok — możesz to pominąć i wrócić później.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/40 p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Globe className="h-5 w-5 text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Google Search Console</p>
            <p className="text-xs text-zinc-500">Uprawnienia wyłącznie do odczytu</p>
          </div>
          {connected && (
            <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-400">
              <CheckCircle className="h-4 w-4" />
              Połączono
            </span>
          )}
        </div>

        {!connected ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 disabled:opacity-60"
          >
            {connecting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Łączenie z Google...</>
            ) : (
              <><span className="font-bold text-blue-600">G</span>Połącz z Google Search Console</>
            )}
          </button>
        ) : (
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-center">
            <CheckCircle className="mx-auto mb-2 h-6 w-6 text-green-400" />
            <p className="text-sm font-medium text-green-300">Połączono pomyślnie!</p>
          </div>
        )}
      </div>
    </div>
  );
}

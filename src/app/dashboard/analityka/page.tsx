'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck } from 'lucide-react';

// ─── Mock data ───────────────────────────────────────────────────────────────

const OPPORTUNITIES = [
  {
    url:         '/blog/jak-zwiekszyc-ruch',
    position:    4,
    ctr:         '1.2%',
    impressions: '8 400',
    insight:     'Strona na 4. pozycji, ale niski CTR sugeruje słaby tytuł — brakuje intencji zakupowej.',
  },
  {
    url:         '/uslugi/pozycjonowanie',
    position:    6,
    ctr:         '0.8%',
    impressions: '5 100',
    insight:     'Wysoka pozycja, ale meta-tytuł nie zawiera głównego słowa kluczowego z intencją.',
  },
  {
    url:         '/produkty/kurs-seo',
    position:    7,
    ctr:         '0.5%',
    impressions: '3 200',
    insight:     'Strona rankuje dla 12 fraz, ale żadna nie jest odzwierciedlona w H1.',
  },
];

const THREATS = [
  {
    label:   'Kanibalizacja słów kluczowych',
    icon:    AlertTriangle,
    desc:    'Dwie strony rywalizują o frazę "pozycjonowanie stron", dzieląc autorytet i obniżając obie pozycje.',
    pages:   ['/uslugi/seo', '/blog/pozycjonowanie'],
  },
  {
    label:   'Nagły spadek ruchu',
    icon:    TrendingDown,
    desc:    'Strona /oferta straciła 38% wyświetleń w ciągu ostatnich 7 dni. Możliwa aktualizacja algorytmu.',
    pages:   ['/oferta'],
  },
];

const PROTECTED = [
  { url: '/blog/seo-dla-poczatkujacych', ctr: '12.4%', impressions: '18 200' },
  { url: '/uslugi/copywriting',           ctr: '9.8%',  impressions: '11 500' },
  { url: '/case-study/ecommerce',         ctr: '8.2%',  impressions: '7 800'  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AnalitykaPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-black px-6 py-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
        <p className="mb-1 text-[11px] uppercase tracking-widest text-gray-600">
          Ostatnia analiza: dziś o 08:23
        </p>
        <p className="text-lg font-semibold text-white leading-snug">
          Agent przeanalizował{' '}
          <span className="text-purple-400">12 400</span>{' '}
          zapytań z Twojego GSC. Znalazł{' '}
          <span className="text-sky-400">3 okazje</span>{' '}
          i{' '}
          <span className="text-red-400">2 problemy</span>.
        </p>
      </div>

      {/* ── 3-column grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* ── Column 1: OKAZJE ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-sky-500/15 bg-sky-500/5 p-5">
          {/* Column header */}
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15">
              <TrendingUp className="h-4 w-4 text-sky-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Okazje</h3>
            <span className="ml-auto rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400">
              3
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500">
            Strony o wysokiej pozycji i niskim CTR — łatwy wzrost bez nowych treści.
          </p>

          <div className="space-y-3">
            {OPPORTUNITIES.map((opp) => (
              <div key={opp.url} className="rounded-xl border border-white/8 bg-black/50 p-4">
                <p className="mb-3 truncate font-mono text-xs text-gray-400">{opp.url}</p>

                <div className="mb-3 flex gap-4">
                  <div>
                    <p className="text-[10px] text-gray-600">Pozycja</p>
                    <p className="text-sm font-bold text-white">#{opp.position}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600">CTR</p>
                    <p className="text-sm font-bold text-orange-400">{opp.ctr}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600">Wyświetlenia</p>
                    <p className="text-sm font-bold text-white">{opp.impressions}</p>
                  </div>
                </div>

                <p className="mb-3 text-xs leading-relaxed text-gray-500">{opp.insight}</p>

                <Link href="/dashboard/chat">
                  <button className="w-full rounded-lg border border-sky-500/25 bg-sky-500/10 py-2 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-500/20">
                    Rozwiąż z Agentem →
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* ── Column 2: ZAGROŻENIA ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Zagrożenia</h3>
            <span className="ml-auto rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
              2
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500">
            Wykryte problemy, które aktywnie obniżają Twoje pozycje i ruch.
          </p>

          <div className="space-y-3">
            {THREATS.map((threat) => (
              <div key={threat.label} className="rounded-xl border border-white/8 bg-black/50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <threat.icon className="h-4 w-4 flex-shrink-0 text-red-400" />
                  <p className="text-xs font-semibold text-red-300">{threat.label}</p>
                </div>

                <p className="mb-3 text-xs leading-relaxed text-gray-500">{threat.desc}</p>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {threat.pages.map((page) => (
                    <span
                      key={page}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-gray-400"
                    >
                      {page}
                    </span>
                  ))}
                </div>

                <Link href="/dashboard/chat">
                  <button className="w-full rounded-lg border border-red-500/25 bg-red-500/10 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20">
                    Rozwiąż z Agentem →
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* ── Column 3: CHRONIONE ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
              <ShieldCheck className="h-4 w-4 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Liderzy — Chronione</h3>
            <span className="ml-auto rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400">
              {PROTECTED.length}
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500">
            Doskonałe wyniki. Agent nie będzie modyfikował tych stron.
          </p>

          <div className="space-y-2">
            {PROTECTED.map((item) => (
              <div
                key={item.url}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/50 p-4"
              >
                <ShieldCheck className="h-5 w-5 flex-shrink-0 text-green-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-gray-300">{item.url}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500">
                    CTR {item.ctr} · {item.impressions} wyświetleń
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-green-500/15 bg-green-500/5 p-3 text-center">
            <p className="text-xs font-medium text-green-400">
              ✓ Chronione przed modyfikacją
            </p>
            <p className="mt-0.5 text-[10px] text-gray-600">
              Agent omija te strony podczas optymalizacji
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

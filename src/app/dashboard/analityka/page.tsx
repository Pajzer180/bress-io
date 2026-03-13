'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getOrCreateDefaultProject } from '@/lib/snippetActions';
import type { Project } from '@/lib/snippetActions';
import type {
  SearchConsoleConnectResponse,
  SearchConsoleSelectPropertyResponse,
  SearchConsoleSitesResponse,
} from '@/types/searchConsole';

const OPPORTUNITIES = [
  {
    url: '/blog/jak-zwiekszyc-ruch',
    position: 4,
    ctr: '1.2%',
    impressions: '8 400',
    insight: 'Strona jest juz wysoko, ale niski CTR sugeruje slaby tytul i slabsze dopasowanie do intencji.',
  },
  {
    url: '/uslugi/pozycjonowanie',
    position: 6,
    ctr: '0.8%',
    impressions: '5 100',
    insight: 'Wysoka pozycja, ale meta title nie pokazuje najmocniejszej intencji wyszukiwania.',
  },
  {
    url: '/produkty/kurs-seo',
    position: 7,
    ctr: '0.5%',
    impressions: '3 200',
    insight: 'Strona rankuje na kilka fraz, ale H1 i snippet nadal nie wykorzystuja tego potencjalu.',
  },
];

const THREATS = [
  {
    label: 'Kanibalizacja slow kluczowych',
    icon: AlertTriangle,
    desc: 'Dwie strony rywalizuja o te sama fraze i dziela autorytet zamiast go wzmacniac.',
    pages: ['/uslugi/seo', '/blog/pozycjonowanie'],
  },
  {
    label: 'Nagly spadek ruchu',
    icon: TrendingDown,
    desc: 'Jedna z glownych stron stracila widocznosc w ostatnich dniach i wymaga szybkiej analizy.',
    pages: ['/oferta'],
  },
];

const PROTECTED = [
  { url: '/blog/seo-dla-poczatkujacych', ctr: '12.4%', impressions: '18 200' },
  { url: '/uslugi/copywriting', ctr: '9.8%', impressions: '11 500' },
  { url: '/case-study/ecommerce', ctr: '8.2%', impressions: '7 800' },
];

function formatDateTime(ts?: number | null): string {
  if (!ts) {
    return '-';
  }

  return new Date(ts).toLocaleString('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function getSearchConsoleFeedback(
  status: string | null,
  reason: string | null,
): { type: 'success' | 'error'; message: string } | null {
  if (status === 'connected') {
    return {
      type: 'success',
      message: 'Google Search Console zostal polaczony z tym projektem.',
    };
  }

  if (status !== 'error') {
    return null;
  }

  switch (reason) {
    case 'oauth-denied':
      return { type: 'error', message: 'Polaczenie z Google zostalo anulowane.' };
    case 'oauth-error':
      return { type: 'error', message: 'Google zwrocil blad podczas autoryzacji.' };
    case 'callback-failed':
      return { type: 'error', message: 'Nie udalo sie dokonczyc polaczenia z Google Search Console.' };
    default:
      return { type: 'error', message: 'Wystapil blad podczas laczenia z Google Search Console.' };
  }
}

function AnalitykaPageFallback() {
  return (
    <div className="flex flex-1 items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
    </div>
  );
}

function AnalitykaPageContent() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gscStatus = searchParams.get('gsc');
  const gscReason = searchParams.get('gscReason');

  const [project, setProject] = useState<Project | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [selectLoading, setSelectLoading] = useState(false);
  const [propertyDraft, setPropertyDraft] = useState('');

  const projectId = project?.id ?? null;
  const projectStatus = project?.searchConsole?.status ?? null;

  const requestAuthorizedJson = useCallback(async <T,>(
    url: string,
    init?: RequestInit,
  ): Promise<T> => {
    if (!user) {
      throw new Error('Brak autoryzacji.');
    }

    const idToken = await user.getIdToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${idToken}`,
      },
      cache: init?.cache ?? 'no-store',
    });

    const data = (await response.json().catch(() => null)) as { error?: string } | T | null;
    if (!response.ok) {
      throw new Error((data as { error?: string } | null)?.error ?? `HTTP ${response.status}`);
    }

    return data as T;
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user || !profile) {
      return;
    }

    setPageLoading(true);
    setPageError(null);

    try {
      const nextProject = await getOrCreateDefaultProject(user.uid, {
        projectName: profile.projectName,
        companyName: profile.companyName,
        domain: profile.domain,
      });
      setProject(nextProject);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : String(error));
    } finally {
      setPageLoading(false);
    }
  }, [profile, user]);

  const loadSites = useCallback(async (nextProjectId: string) => {
    setSitesLoading(true);

    try {
      const response = await requestAuthorizedJson<SearchConsoleSitesResponse>(
        `/api/gsc/sites?projectId=${encodeURIComponent(nextProjectId)}`,
        {
          method: 'GET',
        },
      );

      setProject((current) => {
        if (!current || current.id !== nextProjectId) {
          return current;
        }

        return {
          ...current,
          searchConsole: {
            connectionId: current.searchConsole?.connectionId ?? nextProjectId,
            status: 'connected',
            selectedPropertyUrl: response.selectedPropertyUrl,
            availableProperties: response.items,
            connectedAt: current.searchConsole?.connectedAt ?? Date.now(),
            updatedAt: Date.now(),
            lastSyncedAt: response.lastSyncedAt,
            lastError: null,
          },
        };
      });

      setPropertyDraft((current) => current || response.selectedPropertyUrl || response.items[0]?.siteUrl || '');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : String(error));
    } finally {
      setSitesLoading(false);
    }
  }, [requestAuthorizedJson]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (user && profile) {
      void loadData();
      return;
    }

    if (!loading && user && !profile) {
      setPageLoading(false);
    }
  }, [loadData, loading, profile, router, user]);

  useEffect(() => {
    const nextDraft = project?.searchConsole?.selectedPropertyUrl
      ?? project?.searchConsole?.availableProperties?.[0]?.siteUrl
      ?? '';
    setPropertyDraft(nextDraft);
  }, [project]);

  const feedback = useMemo(
    () => getSearchConsoleFeedback(gscStatus, gscReason),
    [gscReason, gscStatus],
  );

  useEffect(() => {
    if (!projectId || !user) {
      return;
    }

    if (gscStatus === 'connected' || projectStatus === 'connected') {
      void loadSites(projectId);
    }
  }, [gscStatus, loadSites, projectId, projectStatus, user]);

  const handleConnect = async () => {
    if (!projectId) {
      return;
    }

    setConnectLoading(true);
    setPageError(null);

    try {
      const response = await requestAuthorizedJson<SearchConsoleConnectResponse>('/api/gsc/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          returnTo: '/dashboard/analityka',
        }),
      });

      window.location.assign(response.authorizationUrl);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : String(error));
      setConnectLoading(false);
    }
  };

  const handleSelectProperty = async () => {
    if (!projectId || !propertyDraft) {
      return;
    }

    setSelectLoading(true);
    setPageError(null);

    try {
      await requestAuthorizedJson<SearchConsoleSelectPropertyResponse>('/api/gsc/select-site', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          propertyUrl: propertyDraft,
        }),
      });

      await loadSites(projectId);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : String(error));
    } finally {
      setSelectLoading(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-zinc-500">
          Uzupelnij najpierw profil projektu, aby podlaczyc Search Console.
        </p>
      </div>
    );
  }

  const searchConsole = project?.searchConsole ?? null;
  const isConnected = projectStatus === 'connected';
  const availableProperties = searchConsole?.availableProperties ?? [];
  const propertySelectionChanged = propertyDraft !== (searchConsole?.selectedPropertyUrl ?? '');

  return (
    <div className="flex-1 overflow-y-auto bg-black px-6 py-6">
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-purple-400" />
              <p className="text-sm font-semibold text-white">Google Search Console</p>
              <span className={`rounded-full border px-2 py-0.5 text-xs ${
                isConnected
                  ? 'border-green-500/30 bg-green-500/10 text-green-400'
                  : searchConsole?.status === 'failed'
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-white/10 bg-white/5 text-zinc-400'
              }`}>
                {searchConsole?.status ?? 'not-connected'}
              </span>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
              Polacz projekt z Google Search Console, aby bezpiecznie zapisac token OAuth po stronie serwera
              i wybrac wlasciwosc do przyszlego pobierania metryk.
            </p>
            <div className="grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
              <p>Projekt: {project?.name ?? '-'}</p>
              <p>Wybrana wlasciwosc: {searchConsole?.selectedPropertyUrl ?? '-'}</p>
              <p>Ostatnia synchronizacja: {formatDateTime(searchConsole?.lastSyncedAt)}</p>
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={connectLoading || !projectId}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
          >
            {connectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {connectLoading
              ? 'Przekierowanie do Google...'
              : isConnected
                ? 'Polacz ponownie'
                : 'Polacz z Google'}
          </button>
        </div>

        {feedback && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-green-500/20 bg-green-500/5 text-green-300'
              : 'border-red-500/20 bg-red-500/5 text-red-300'
          }`}>
            {feedback.message}
          </div>
        )}

        {pageError && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {pageError}
          </div>
        )}

        {searchConsole?.lastError && !feedback && !pageError && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {searchConsole.lastError}
          </div>
        )}

        {isConnected && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Wlasciwosc Search Console dla projektu
              </label>
              {sitesLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-zinc-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pobieranie properties z Google...
                </div>
              ) : availableProperties.length > 0 ? (
                <select
                  value={propertyDraft}
                  onChange={(event) => setPropertyDraft(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500/50"
                >
                  {availableProperties.map((property) => (
                    <option key={property.siteUrl} value={property.siteUrl}>
                      {property.siteUrl} ({property.permissionLevel})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5 text-sm text-yellow-200">
                  Konto zostalo polaczone, ale Google nie zwrocilo zadnych dostepnych properties.
                </div>
              )}
            </div>

            <button
              onClick={handleSelectProperty}
              disabled={!availableProperties.length || !propertySelectionChanged || selectLoading || sitesLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {selectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {selectLoading ? 'Zapisywanie...' : 'Zapisz wybrana wlasciwosc'}
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
        <p className="mb-1 text-[11px] uppercase tracking-widest text-gray-600">
          Ostatnia analiza: dzis o 08:23
        </p>
        <p className="text-lg font-semibold leading-snug text-white">
          Agent przeanalizowal <span className="text-purple-400">12 400</span> zapytan z Twojego GSC.
          Znalazl <span className="text-sky-400">3 okazje</span> i <span className="text-red-400">2 problemy</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-sky-500/15 bg-sky-500/5 p-5">
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
            Strony o wysokiej pozycji i niskim CTR. Szybki wzrost bez nowych tresci.
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
                    <p className="text-[10px] text-gray-600">Wyswietlenia</p>
                    <p className="text-sm font-bold text-white">{opp.impressions}</p>
                  </div>
                </div>

                <p className="mb-3 text-xs leading-relaxed text-gray-500">{opp.insight}</p>

                <Link href="/dashboard/chat">
                  <button className="w-full rounded-lg border border-sky-500/25 bg-sky-500/10 py-2 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-500/20">
                    Rozwiaz z Agentem {'->'}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Zagrozenia</h3>
            <span className="ml-auto rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
              2
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500">
            Problemy, ktore aktywnie oslabiaja pozycje i ruch organiczny.
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
                    Rozwiaz z Agentem {'->'}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
              <ShieldCheck className="h-4 w-4 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Liderzy chronione</h3>
            <span className="ml-auto rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400">
              {PROTECTED.length}
            </span>
          </div>

          <p className="mb-4 text-xs text-gray-500">
            Najlepsze strony, ktorych agent nie powinien ruszac bez mocnego powodu.
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
                    CTR {item.ctr} · {item.impressions} wyswietlen
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-green-500/15 bg-green-500/5 p-3 text-center">
            <p className="text-xs font-medium text-green-400">
              Protected before optimization
            </p>
            <p className="mt-0.5 text-[10px] text-gray-600">
              Agent omija te strony podczas rekomendacji zmian.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalitykaPage() {
  return (
    <Suspense fallback={<AnalitykaPageFallback />}>
      <AnalitykaPageContent />
    </Suspense>
  );
}

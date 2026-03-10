'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import { getMessages } from '@/lib/chatFirestore';
import { getOrCreateDefaultProject, getSnippetStatus } from '@/lib/snippetActions';
import type { SiteInstall } from '@/lib/snippetActions';
import type { AgentMode, AgentStyle, ChatSession } from '@/types/chat';
import { PanelLeftOpen } from 'lucide-react';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';

interface MessagePart {
  type: string;
  [key: string]: unknown;
}

interface InitialMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
}
function resolveActiveSiteFromInstall(install: SiteInstall): {
  url: string | null;
  domain: string | null;
  source: 'snippet';
} {
  const rawPageUrl = install.pageUrl?.trim();
  if (rawPageUrl) {
    try {
      const parsed = new URL(rawPageUrl);
      return { url: parsed.toString(), domain: parsed.hostname, source: 'snippet' };
    } catch {
      // Fall back to domain when stored pageUrl is invalid.
    }
  }

  const rawDomain = install.domain?.trim();
  if (!rawDomain) return { url: null, domain: null, source: 'snippet' };

  const fallbackUrl = /^https?:\/\//i.test(rawDomain)
    ? rawDomain
    : `https://${rawDomain}`;
  try {
    const parsed = new URL(fallbackUrl);
    return { url: parsed.toString(), domain: parsed.hostname, source: 'snippet' };
  } catch {
    return { url: null, domain: rawDomain, source: 'snippet' };
  }
}

export default function ChatLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [sessions,        setSessions]        = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatKey,         setChatKey]         = useState('initial');
  const [initialMessages, setInitialMessages] = useState<InitialMessage[]>([]);
  const [agentMode,       setAgentMode]       = useState<AgentMode>('business');
  const [agentStyle,      setAgentStyle]      = useState<AgentStyle>('action');
  const [sidebarOpen,     setSidebarOpen]     = useState(true);
  const [activeSiteUrl,   setActiveSiteUrl]   = useState<string | null>(null);
  const [activeSiteDomain, setActiveSiteDomain] = useState<string | null>(null);
  const [activeSiteSource, setActiveSiteSource] = useState<'snippet' | null>(null);

  // Close sidebar on mobile by default (runs only on client)
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Fetch active site from snippet install
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const project = await getOrCreateDefaultProject(user.uid, { domain: '' });
        const install = await getSnippetStatus(project.id);
        if (install) {
          const active = resolveActiveSiteFromInstall(install);
          setActiveSiteUrl(active.url);
          setActiveSiteDomain(active.domain);
          setActiveSiteSource(active.source);
        } else {
          setActiveSiteUrl(null);
          setActiveSiteDomain(null);
          setActiveSiteSource(null);
        }
      } catch {
        setActiveSiteUrl(null);
        setActiveSiteDomain(null);
        setActiveSiteSource(null);
      }
    })();
  }, [user]);

  // Real-time sessions subscription
  useEffect(() => {
    if (!user) return;
    const db = getClientDb();
    const q = query(
      collection(db, 'chats', user.uid, 'sessions'),
      orderBy('updatedAt', 'desc'),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatSession, 'id'>),
      })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleSelectSession = async (sessionId: string) => {
    if (!user) return;
    const msgs = await getMessages(user.uid, sessionId);
    setInitialMessages(msgs);
    setActiveSessionId(sessionId);
    setChatKey(sessionId);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setInitialMessages([]);
    setChatKey(Date.now().toString());
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const userInitial = user.email?.[0].toUpperCase() ?? 'U';

  return (
    <div className="flex flex-1 min-w-0 min-h-0 bg-black">
      {sidebarOpen && (
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onCollapse={() => setSidebarOpen(false)}
        />
      )}

      <div className="relative flex flex-1 min-w-0 min-h-0 flex-col overflow-hidden">
        {/* Show sidebar button when collapsed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Pokaż historię chatów"
            className="absolute left-3 top-3 z-10 rounded-lg bg-zinc-800/60 p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <ChatWindow
          key={chatKey}
          activeSessionId={activeSessionId}
          onSessionCreate={setActiveSessionId}
          initialMessages={initialMessages}
          agentMode={agentMode}
          agentStyle={agentStyle}
          userId={user.uid}
          userInitial={userInitial}
          onAgentModeChange={setAgentMode}
          onAgentStyleChange={setAgentStyle}
          onNewChat={handleNewChat}
          activeSiteUrl={activeSiteUrl}
          activeSiteDomain={activeSiteDomain}
          activeSiteSource={activeSiteSource}
        />
      </div>
    </div>
  );
}




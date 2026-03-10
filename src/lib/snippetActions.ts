import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  query,
  collection,
  where,
  limit,
  getDocs,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';

export interface ProjectWordPressState {
  siteUrl: string;
  wpUsername: string;
  status: 'connected' | 'failed' | 'disconnected';
  lastCheckedAt: number | null;
  lastError: string | null;
  lastVerifiedUser?: string | null;
  connectionId?: string | null;
}

export interface Project {
  id: string;
  uid: string;
  name: string;
  domain: string;
  snippetToken: string | null;
  snippetEnabled: boolean;
  snippetCreatedAt: number | null;
  wordpress?: ProjectWordPressState | null;
  createdAt: number;
  updatedAt: number;
}

export interface SiteInstall {
  projectId: string;
  uid: string;
  snippetToken: string;
  domain: string;
  pageUrl: string;
  pageTitle: string;
  userAgent: string;
  viewportWidth: number | null;
  viewportHeight: number | null;
  installedAt: number;
  lastSeenAt: number;
  source: 'js-snippet';
  pingCount: number;
}

export async function getOrCreateDefaultProject(
  uid: string,
  profile: { projectName?: string; companyName?: string; domain: string },
): Promise<Project> {
  const db = getClientDb();

  const q = query(
    collection(db, 'projects'),
    where('uid', '==', uid),
    limit(1),
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    const existing = snap.docs[0];
    return { id: existing.id, ...existing.data() } as Project;
  }

  const now = Date.now();
  const ref = doc(collection(db, 'projects'));
  const data: Omit<Project, 'id'> = {
    uid,
    name: profile.projectName || profile.companyName || 'Moj projekt',
    domain: profile.domain,
    snippetToken: null,
    snippetEnabled: true,
    snippetCreatedAt: null,
    wordpress: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

function generateSecureToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function generateSnippetToken(projectId: string): Promise<string> {
  const token = generateSecureToken();
  const db = getClientDb();
  const now = Date.now();

  await updateDoc(doc(db, 'projects', projectId), {
    snippetToken: token,
    snippetEnabled: true,
    snippetCreatedAt: now,
    updatedAt: now,
  });

  return token;
}

export async function getSnippetStatus(
  projectId: string,
): Promise<SiteInstall | null> {
  const db = getClientDb();

  const q = query(
    collection(db, 'siteInstalls'),
    where('projectId', '==', projectId),
    limit(10),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const installs = snap.docs.map((item) => item.data() as SiteInstall);
  installs.sort((left, right) => right.lastSeenAt - left.lastSeenAt);
  return installs[0];
}

export function siteInstallDocId(projectId: string, domain: string): string {
  return `${projectId}_${domain}`;
}

export async function findProjectByToken(
  token: string,
): Promise<Project | null> {
  const db = getClientDb();
  const q = query(
    collection(db, 'projects'),
    where('snippetToken', '==', token),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const existing = snap.docs[0];
  return { id: existing.id, ...existing.data() } as Project;
}

export async function upsertSiteInstall(
  project: Project,
  data: {
    domain: string;
    pageUrl: string;
    pageTitle: string;
    userAgent: string;
    viewportWidth: number | null;
    viewportHeight: number | null;
  },
): Promise<void> {
  const db = getClientDb();
  const docId = siteInstallDocId(project.id, data.domain);
  const ref = doc(db, 'siteInstalls', docId);
  const now = Date.now();

  const existing = await getDoc(ref);

  if (existing.exists()) {
    await updateDoc(ref, {
      lastSeenAt: now,
      pingCount: increment(1),
      pageUrl: data.pageUrl,
      pageTitle: data.pageTitle,
      userAgent: data.userAgent,
      viewportWidth: data.viewportWidth,
      viewportHeight: data.viewportHeight,
    });
    return;
  }

  const install: SiteInstall = {
    projectId: project.id,
    uid: project.uid,
    snippetToken: project.snippetToken!,
    domain: data.domain,
    pageUrl: data.pageUrl,
    pageTitle: data.pageTitle,
    userAgent: data.userAgent,
    viewportWidth: data.viewportWidth,
    viewportHeight: data.viewportHeight,
    installedAt: now,
    lastSeenAt: now,
    source: 'js-snippet',
    pingCount: 1,
  };

  await setDoc(ref, install);
}
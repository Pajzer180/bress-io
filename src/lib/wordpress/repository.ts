import 'server-only';

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getClientDb } from '@/lib/firebase';
import type { ProjectWordPressState } from '@/lib/snippetActions';
import type {
  WordPressConnectionRecord,
  WordPressJobRecord,
} from '@/types/wordpress';

function getConnectionRef(userId: string) {
  const db = getClientDb();
  return doc(db, 'wordpress_connections', userId);
}

export async function getWordPressConnection(
  userId: string,
): Promise<WordPressConnectionRecord | null> {
  const snap = await getDoc(getConnectionRef(userId));
  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...(snap.data() as Omit<WordPressConnectionRecord, 'id'>),
  };
}

export async function saveWordPressConnection(
  connection: Omit<WordPressConnectionRecord, 'id'>,
): Promise<WordPressConnectionRecord> {
  await setDoc(getConnectionRef(connection.userId), connection);
  return {
    id: connection.userId,
    ...connection,
  };
}

export async function updateProjectWordPressSummary(
  projectId: string,
  summary: ProjectWordPressState | null,
): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, 'projects', projectId), {
    wordpress: summary,
    updatedAt: Date.now(),
  });
}

export async function createWordPressJob(
  job: Omit<WordPressJobRecord, 'id'>,
): Promise<WordPressJobRecord> {
  const db = getClientDb();
  const ref = await addDoc(collection(db, 'wordpress_jobs'), job);
  return {
    id: ref.id,
    ...job,
  };
}

export async function getWordPressJob(
  jobId: string,
): Promise<WordPressJobRecord | null> {
  const db = getClientDb();
  const snap = await getDoc(doc(db, 'wordpress_jobs', jobId));
  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...(snap.data() as Omit<WordPressJobRecord, 'id'>),
  };
}

export async function updateWordPressJob(
  jobId: string,
  patch: Partial<Omit<WordPressJobRecord, 'id'>>,
): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, 'wordpress_jobs', jobId), patch);
}

export async function listWordPressJobsByUser(
  userId: string,
  limitCount = 20,
): Promise<WordPressJobRecord[]> {
  const db = getClientDb();
  const q = query(
    collection(db, 'wordpress_jobs'),
    where('userId', '==', userId),
    limitQuery(limitCount),
  );
  const snap = await getDocs(q);

  return snap.docs
    .map((item) => ({
      id: item.id,
      ...(item.data() as Omit<WordPressJobRecord, 'id'>),
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
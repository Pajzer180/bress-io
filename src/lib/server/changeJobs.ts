import 'server-only';

import { getFirestoreAdmin } from '@/lib/server/firestoreAdmin';
import type { ChangeJobRecord, ChangeJobStatus } from '@/types/changeJobs';

export const CHANGE_JOBS_COLLECTION = 'change_jobs';

function changeJobsCollection() {
  return getFirestoreAdmin().collection(CHANGE_JOBS_COLLECTION);
}

export async function createChangeJob(
  job: Omit<ChangeJobRecord, 'id'>,
  jobId?: string,
): Promise<ChangeJobRecord> {
  const ref = jobId ? changeJobsCollection().doc(jobId) : changeJobsCollection().doc();
  await ref.set(job);

  return {
    id: ref.id,
    ...job,
  };
}

export async function getChangeJob(jobId: string): Promise<ChangeJobRecord | null> {
  const snapshot = await changeJobsCollection().doc(jobId).get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<ChangeJobRecord, 'id'>),
  };
}

export async function updateChangeJob(
  jobId: string,
  patch: Partial<Omit<ChangeJobRecord, 'id'>>,
): Promise<void> {
  await changeJobsCollection().doc(jobId).update(patch);
}

export async function listChangeJobsByProject(
  projectId: string,
  options: {
    status?: ChangeJobStatus;
    limit?: number;
  } = {},
): Promise<ChangeJobRecord[]> {
  let query: FirebaseFirestore.Query = changeJobsCollection()
    .where('projectId', '==', projectId);

  if (options.status) {
    query = query.where('status', '==', options.status);
  }

  const snapshot = await query.get();
  const limit = typeof options.limit === 'number' && options.limit > 0
    ? Math.floor(options.limit)
    : null;

  const jobs = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<ChangeJobRecord, 'id'>),
    }))
    .sort((left, right) => right.createdAt - left.createdAt);

  return limit === null ? jobs : jobs.slice(0, limit);
}
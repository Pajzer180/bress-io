import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { listChangeHistoryByProject } from '@/lib/changeHistory';
import { getClientDb } from '@/lib/firebase';

interface AccountsLookupResponse {
  users?: Array<{ localId?: string }>;
}

async function resolveUidFromBearerToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const idToken = match[1]?.trim();
  if (!idToken) return null;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_API_KEY');
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    },
  );

  if (!res.ok) return null;

  const data = (await res.json()) as AccountsLookupResponse;
  return data.users?.[0]?.localId ?? null;
}

async function userHasAccessToProject(uid: string, projectId: string): Promise<boolean> {
  const db = getClientDb();
  const projectSnap = await getDoc(doc(db, 'projects', projectId));
  if (!projectSnap.exists()) return false;
  const project = projectSnap.data() as { uid?: string };
  return project.uid === uid;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId')?.trim();
    const limitRaw = Number(searchParams.get('limit') ?? '50');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Brak parametru projectId' },
        { status: 400 },
      );
    }

    const uid = await resolveUidFromBearerToken(req);
    if (!uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const hasAccess = await userHasAccessToProject(uid, projectId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 },
      );
    }

    const items = await listChangeHistoryByProject(
      projectId,
      Number.isFinite(limitRaw) ? limitRaw : 50,
    );

    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
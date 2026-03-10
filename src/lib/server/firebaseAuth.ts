import 'server-only';

import { doc, getDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';
import { getClientDb } from '@/lib/firebase';

interface AccountsLookupResponse {
  users?: Array<{ localId?: string }>;
}

export class RouteError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'RouteError';
    this.status = status;
    this.details = details;
  }
}

export async function resolveUidFromBearerToken(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const idToken = match[1]?.trim();
  if (!idToken) return null;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new RouteError(500, 'Missing NEXT_PUBLIC_FIREBASE_API_KEY');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    },
  );

  if (!response.ok) return null;

  const data = (await response.json()) as AccountsLookupResponse;
  return data.users?.[0]?.localId ?? null;
}

export async function requireAuthenticatedUid(req: Request): Promise<string> {
  const uid = await resolveUidFromBearerToken(req);
  if (!uid) {
    throw new RouteError(401, 'Unauthorized');
  }
  return uid;
}

export function toRouteErrorResponse(error: unknown): NextResponse {
  if (error instanceof RouteError) {
    return NextResponse.json(
      { error: error.message, details: error.details ?? null },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function assertProjectOwnedByUser(uid: string, projectId: string): Promise<void> {
  const db = getClientDb();
  const projectSnap = await getDoc(doc(db, 'projects', projectId));

  if (!projectSnap.exists()) {
    throw new RouteError(403, 'Forbidden');
  }

  const project = projectSnap.data() as { uid?: string };
  if (project.uid !== uid) {
    throw new RouteError(403, 'Forbidden');
  }
}
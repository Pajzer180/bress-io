import { NextResponse } from 'next/server';
import { assertProjectOwnedByUser, requireAuthenticatedUid, RouteError } from '@/lib/server/firebaseAuth';
import { disconnectWordPressConnection } from '@/lib/wordpress/service';
import type { WordPressDisconnectRequestBody } from '@/types/wordpress';

function toErrorResponse(error: unknown) {
  if (error instanceof RouteError) {
    return NextResponse.json({ error: error.message, details: error.details ?? null }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(req: Request) {
  try {
    const uid = await requireAuthenticatedUid(req);
    const body = (await req.json()) as WordPressDisconnectRequestBody;

    if (body.projectId) {
      await assertProjectOwnedByUser(uid, body.projectId);
    }

    await disconnectWordPressConnection(uid, body.projectId ?? null);
    return NextResponse.json({ ok: true, status: 'disconnected' });
  } catch (error) {
    return toErrorResponse(error);
  }
}
import { NextResponse } from 'next/server';
import { requireAuthenticatedUid, RouteError } from '@/lib/server/firebaseAuth';
import { fetchWordPressItems } from '@/lib/wordpress/service';
import type { WordPressFetchRequestBody } from '@/types/wordpress';

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
    const body = (await req.json()) as WordPressFetchRequestBody;

    if (body.targetType !== 'pages' && body.targetType !== 'posts') {
      throw new RouteError(400, 'targetType musi byc rowne pages albo posts.');
    }

    const response = await fetchWordPressItems(uid, body.targetType, body.search);
    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
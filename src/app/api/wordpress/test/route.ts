import { NextResponse } from 'next/server';
import { assertProjectOwnedByUser, requireAuthenticatedUid, RouteError } from '@/lib/server/firebaseAuth';
import { enforceRateLimit } from '@/lib/server/rateLimit';
import { connectWordPressConnection } from '@/lib/wordpress/service';
import type { WordPressConnectRequestBody } from '@/types/wordpress';

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
    const rateLimitResponse = enforceRateLimit(req, { scope: 'wordpress-test', uid });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = (await req.json()) as WordPressConnectRequestBody;

    if (body.projectId) {
      await assertProjectOwnedByUser(uid, body.projectId);
    }

    const response = await connectWordPressConnection({
      uid,
      projectId: body.projectId ?? null,
      siteUrl: body.siteUrl,
      wpUsername: body.wpUsername,
      applicationPassword: body.applicationPassword,
    });

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
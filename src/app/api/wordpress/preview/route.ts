import { NextResponse } from 'next/server';
import { requireAuthenticatedUid, RouteError } from '@/lib/server/firebaseAuth';
import { enforceRateLimit } from '@/lib/server/rateLimit';
import { createWordPressPreviewJob } from '@/lib/wordpress/service';
import type { WordPressPreviewRequestBody } from '@/types/wordpress';

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
    const rateLimitResponse = enforceRateLimit(req, { scope: 'wordpress-preview', uid });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = (await req.json()) as WordPressPreviewRequestBody;

    if (body.targetType !== 'page' && body.targetType !== 'post') {
      throw new RouteError(400, 'targetType musi byc rowne page albo post.');
    }

    const response = await createWordPressPreviewJob({
      uid,
      targetType: body.targetType,
      targetId: body.targetId,
      suggestedTitle: body.suggestedTitle,
      suggestedContent: body.suggestedContent,
    });

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
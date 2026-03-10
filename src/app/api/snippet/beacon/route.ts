import { NextRequest, NextResponse } from 'next/server';
import { findProjectByToken, upsertSiteInstall } from '@/lib/snippetActions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, hostname, url, title, userAgent, vw, vh } = body;
    console.log('[beacon] received:', { token: token?.slice(0, 8), hostname });

    if (!token || !hostname) {
      return NextResponse.json(
        { error: 'missing token or hostname' },
        { status: 400, headers: CORS },
      );
    }

    const project = await findProjectByToken(token);
    console.log('[beacon] project:', project ? project.id : 'NOT FOUND');

    if (!project) {
      return NextResponse.json(
        { error: 'invalid token' },
        { status: 404, headers: CORS },
      );
    }

    if (!project.snippetEnabled) {
      return NextResponse.json(
        { error: 'snippet disabled' },
        { status: 403, headers: CORS },
      );
    }

    await upsertSiteInstall(project, {
      domain: hostname,
      pageUrl: String(url ?? ''),
      pageTitle: String(title ?? ''),
      userAgent: String(userAgent ?? ''),
      viewportWidth: typeof vw === 'number' ? vw : null,
      viewportHeight: typeof vh === 'number' ? vh : null,
    });

    console.log('[beacon] upsert done, returning ok');
    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (err) {
    console.error('[beacon] ERROR:', err);
    return NextResponse.json(
      { error: 'internal error' },
      { status: 500, headers: CORS },
    );
  }
}

import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return new NextResponse('Brak parametru clientId', { status: 400 });
  }

  const filePath = join(process.cwd(), 'src', 'lib', 'snippet', 'agent.js');
  const code = readFileSync(filePath, 'utf-8');

  return new NextResponse(code, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store',
    },
  });
}

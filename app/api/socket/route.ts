import { NextResponse } from 'next/server';
import { initSocketServer } from '@/server/socket-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Access the underlying Node HTTP server from the request socket
    const server = (req as any).socket?.server;
    if (server && !server.io) {
      initSocketServer(server);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

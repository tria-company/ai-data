import { Server as SocketIOServer } from 'socket.io';
import { type Server as HTTPServer } from 'http';
import {
  createSession,
  extractCookies,
  destroySession,
  VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT,
  type BrowserSession,
} from '@/lib/browser-session';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log('[Socket.io] Client connected:', socket.id);
    let session: BrowserSession | null = null;

    socket.on('start-session', async () => {
      try {
        if (session) {
          await destroySession(session);
        }
        session = await createSession((base64Data) => {
          socket.emit('screencast-frame', base64Data);
        });
        socket.emit('session-status', {
          status: 'connected',
          viewportWidth: VIEWPORT_WIDTH,
          viewportHeight: VIEWPORT_HEIGHT,
        });
      } catch (err: any) {
        console.error('[Socket.io] Failed to start session:', err.message);
        socket.emit('session-error', { message: err.message });
      }
    });

    socket.on('mouse-click', async ({ x, y }: { x: number; y: number }) => {
      if (!session?.page) return;
      try { await session.page.mouse.click(x, y); } catch {}
    });

    socket.on('mouse-move', async ({ x, y }: { x: number; y: number }) => {
      if (!session?.page) return;
      try { await session.page.mouse.move(x, y); } catch {}
    });

    socket.on('key-press', async ({ key }: { key: string }) => {
      if (!session?.page) return;
      try { await session.page.keyboard.press(key as any); } catch {}
    });

    socket.on('key-type', async ({ text }: { text: string }) => {
      if (!session?.page) return;
      try { await session.page.keyboard.type(text); } catch {}
    });

    socket.on('scroll', async ({ deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
      if (!session?.page) return;
      try { await session.page.mouse.wheel({ deltaX, deltaY }); } catch {}
    });

    socket.on('capture-cookies', async () => {
      if (!session?.page) {
        socket.emit('cookies-error', { message: 'Nenhuma sessao ativa' });
        return;
      }
      try {
        const cookies = await extractCookies(session.page);
        socket.emit('cookies-captured', { cookies });
      } catch (err: any) {
        socket.emit('cookies-error', { message: err.message });
      }
    });

    socket.on('stop-session', async () => {
      if (session) {
        await destroySession(session);
        session = null;
      }
      socket.emit('session-status', { status: 'disconnected' });
    });

    socket.on('disconnect', async () => {
      console.log('[Socket.io] Client disconnected:', socket.id);
      if (session) {
        await destroySession(session);
        session = null;
      }
    });
  });

  console.log('[Socket.io] Server initialized on path /api/socket/io');
  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

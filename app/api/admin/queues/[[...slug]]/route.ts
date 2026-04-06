import { serverAdapter } from '@/lib/bullboard';
import express from 'express';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const app = express();
app.use('/api/admin/queues', serverAdapter.getRouter());

function expressToNextHandler(req: NextRequest): Promise<NextResponse> {
  return new Promise((resolve) => {
    const url = new URL(req.url);
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const mockReq = {
      method: req.method,
      url: url.pathname + url.search,
      path: url.pathname,
      headers,
      query: Object.fromEntries(url.searchParams),
      on: () => {},
      pipe: () => {},
    };

    const chunks: Buffer[] = [];
    let statusCode = 200;
    const resHeaders: Record<string, string> = {};

    const mockRes = {
      statusCode: 200,
      status(code: number) {
        statusCode = code;
        mockRes.statusCode = code;
        return mockRes;
      },
      setHeader(name: string, value: string) {
        resHeaders[name.toLowerCase()] = value;
        return mockRes;
      },
      getHeader(name: string) {
        return resHeaders[name.toLowerCase()];
      },
      removeHeader(name: string) {
        delete resHeaders[name.toLowerCase()];
      },
      writeHead(code: number, hdrs?: Record<string, string>) {
        statusCode = code;
        if (hdrs) Object.assign(resHeaders, hdrs);
        return mockRes;
      },
      write(chunk: string | Buffer) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      },
      end(chunk?: string | Buffer) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks);
        const nextRes = new NextResponse(body, {
          status: statusCode,
          headers: resHeaders,
        });
        resolve(nextRes);
      },
      json(data: unknown) {
        resHeaders['content-type'] = 'application/json';
        mockRes.end(JSON.stringify(data));
      },
      send(data: string | Buffer) {
        mockRes.end(data);
      },
      redirect(url: string) {
        resolve(NextResponse.redirect(url, 302));
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app(mockReq as any, mockRes as any, () => {
      resolve(new NextResponse('Not Found', { status: 404 }));
    });
  });
}

export async function GET(req: NextRequest) {
  return expressToNextHandler(req);
}

export async function POST(req: NextRequest) {
  return expressToNextHandler(req);
}

export async function PUT(req: NextRequest) {
  return expressToNextHandler(req);
}

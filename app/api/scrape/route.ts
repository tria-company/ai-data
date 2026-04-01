
import { NextResponse } from 'next/server';
import { scrapeAccounts } from '@/lib/scraper';

export const maxDuration = 300;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { accountId, targetUsernames, projetoId } = body;

        if (!accountId || !targetUsernames || !Array.isArray(targetUsernames)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (type: string, data: any) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
                };

                const onLog = (msg: string) => {
                    sendEvent('log', { message: msg });
                };

                try {
                    const results = await scrapeAccounts(targetUsernames, accountId, projetoId || null, onLog);
                    sendEvent('complete', { results });
                } catch (error: any) {
                    sendEvent('error', { message: error.message });
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

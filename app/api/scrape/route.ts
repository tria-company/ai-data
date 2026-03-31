
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

        const results = await scrapeAccounts(targetUsernames, accountId, projetoId || null);

        return NextResponse.json({ results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

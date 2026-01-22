
import { NextResponse } from 'next/server';
import { performLogin } from '@/lib/scraper';

export const maxDuration = 300;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { accountId } = body;

        if (!accountId) {
            return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
        }

        const result = await performLogin(accountId);

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

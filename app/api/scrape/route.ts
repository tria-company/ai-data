import { NextResponse } from 'next/server';
import { profileScrapeQueue } from '@/lib/queue';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, targetUsernames, projetoId } = body;

    if (!targetUsernames || !Array.isArray(targetUsernames) || targetUsernames.length === 0) {
      return NextResponse.json(
        { error: 'targetUsernames must be a non-empty array' },
        { status: 400 }
      );
    }

    const jobIds: string[] = [];

    for (const username of targetUsernames) {
      const job = await profileScrapeQueue.add('profile-scrape', {
        username,
        projetoId: projetoId || null,
        accountId: accountId || null,
      });
      jobIds.push(job.id!);
    }

    return NextResponse.json(
      { jobIds, status: 'queued', count: jobIds.length },
      { status: 202 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

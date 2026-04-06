import { NextResponse } from 'next/server';
import { profileScrapeQueue } from '@/lib/queue';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await profileScrapeQueue.getJob(id);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const state = await job.getState();

    return NextResponse.json({
      jobId: job.id,
      status: state,
      progress: job.progress,
      result: job.returnvalue,
      error: job.failedReason || null,
      createdAt: new Date(job.timestamp).toISOString(),
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      data: job.data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

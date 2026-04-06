import { NextResponse } from 'next/server';
import { Job } from 'bullmq';
import { profileScrapeQueue } from '@/lib/queue';

type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

const ALL_STATES: JobState[] = ['waiting', 'active', 'completed', 'failed', 'delayed'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projetoId = searchParams.get('projetoId');
    const status = searchParams.get('status') as JobState | null;

    const types: JobState[] = status ? [status] : ALL_STATES;

    const jobs = await profileScrapeQueue.getJobs(types, 0, 99);

    let results: Array<{
      jobId: string | undefined;
      status: string;
      progress: number | object;
      username: string;
      projetoId: string | null;
      createdAt: string;
      finishedAt: string | null;
    }>;

    if (status) {
      // When filtering by a single status, infer state from the type parameter
      // instead of calling job.getState() per-job (avoids N Redis calls)
      results = jobs.map((job: Job) => ({
        jobId: job.id,
        status,
        progress: job.progress,
        username: job.data?.username,
        projetoId: job.data?.projetoId || null,
        createdAt: new Date(job.timestamp).toISOString(),
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      }));
    } else {
      // When listing all types, we need to resolve each job's state
      const states = await Promise.all(jobs.map((job: Job) => job.getState()));
      results = jobs.map((job: Job, i: number) => ({
        jobId: job.id,
        status: states[i],
        progress: job.progress,
        username: job.data?.username,
        projetoId: job.data?.projetoId || null,
        createdAt: new Date(job.timestamp).toISOString(),
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      }));
    }

    // Filter by projetoId if provided
    if (projetoId) {
      results = results.filter((j) => j.projetoId === projetoId);
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

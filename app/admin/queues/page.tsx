import { redirect } from 'next/navigation';

export default function QueuesPage() {
  redirect('/api/admin/queues');
}

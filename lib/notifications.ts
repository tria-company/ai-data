import { Resend } from 'resend';

interface NoAccountsAlertParams {
  jobId: string;
  username: string;
  triedAccounts: { username: string; reason: string }[];
  queueName: string; // 'profile-scrape' or 'post-details'
}

/**
 * sendNoAccountsAlert() — Send email notification when no accounts with valid cookies are available.
 *
 * Gracefully handles missing env vars and email send failures (logs warning, never throws).
 */
export async function sendNoAccountsAlert({
  jobId,
  username,
  triedAccounts,
  queueName,
}: NoAccountsAlertParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL;

  if (!apiKey || !alertEmail) {
    console.warn(
      '[notifications] RESEND_API_KEY or ALERT_EMAIL not set, skipping email notification',
    );
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const triedAccountsHtml =
    triedAccounts.length > 0
      ? `<ul>${triedAccounts.map((a) => `<li><strong>@${a.username}</strong>: ${a.reason}</li>`).join('')}</ul>`
      : '<p>No accounts with valid cookies found in database</p>';

  const html = `
    <h2>Scraper Alert: No Accounts Available</h2>
    <p>A scraping job could not find any accounts with valid cookies.</p>

    <h3>Job Details</h3>
    <ul>
      <li><strong>Job ID:</strong> ${jobId}</li>
      <li><strong>Queue:</strong> ${queueName}</li>
      <li><strong>Target:</strong> @${username}</li>
    </ul>

    <h3>Tried Accounts</h3>
    ${triedAccountsHtml}

    <h3>How to Fix</h3>
    <ol>
      <li>Go to <a href="${appUrl}/admin/login-session">${appUrl}/admin/login-session</a></li>
      <li>Log in with an Instagram account to refresh the session cookies</li>
      <li>The job has been re-queued with a 30-minute delay and will retry automatically</li>
    </ol>

    <p style="color: #888; font-size: 12px;">
      This alert was sent because all scraper accounts have expired cookies.
      The job has been re-queued with a 30-minute delay.
    </p>
  `.trim();

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from: fromEmail,
      to: [alertEmail],
      subject: `[Scraper Alert] No accounts available - @${username}`,
      html,
    });
    console.log(`[notifications] Alert email sent for job ${jobId}`);
  } catch (error) {
    console.error(
      `[notifications] Failed to send alert email for job ${jobId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

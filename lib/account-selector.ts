import Redis from 'ioredis';
import { supabase } from './supabase';

// Redis client for rate limiting (maxRetriesPerRequest: null per BullMQ compatibility)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

/**
 * Account type — matches scrapper_accounts table shape
 */
export interface Account {
  id: string;
  username: string;
  password_encrypted: string | null;
  is_active: boolean;
  last_login: string | null;
  session_cookies: any;
  created_at: string;
  updated_at: string | null;
  cookie_valid: boolean;
  failed_attempts: number;
  last_used_at: string | null;
}

/**
 * selectAccount() — Round-robin account selection with per-account rate limiting.
 *
 * Queries active accounts with valid cookies, ordered by last_used_at ASC NULLS FIRST.
 * Skips accounts that have a Redis rate-limit key (30s cooldown).
 * Returns the selected account or null if all are rate-limited.
 */
export async function selectAccount(): Promise<Account | null> {
  const { data: accounts, error } = await supabase
    .from('scrapper_accounts')
    .select('*')
    .eq('cookie_valid', true)
    .eq('is_active', true)
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .limit(10);

  if (error) {
    console.error('[account-selector] Error querying accounts:', error.message);
    return null;
  }

  if (!accounts || accounts.length === 0) {
    console.log('[account-selector] No active accounts with valid cookies found');
    return null;
  }

  for (const account of accounts as Account[]) {
    // Check Redis rate-limit key — if exists, skip this account
    const rateLimited = await redis.get(`rate:account:${account.id}`);
    if (rateLimited) {
      continue;
    }

    // Set rate-limit key with 30s TTL
    await redis.set(`rate:account:${account.id}`, '1', 'EX', 30);

    // Update last_used_at in Supabase
    await supabase
      .from('scrapper_accounts')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', account.id);

    console.log(`[account-selector] Selected account: ${account.username} (${account.id})`);
    return account;
  }

  console.log('[account-selector] All accounts are rate-limited');
  return null;
}

/**
 * markAccountInvalid() — Mark an account as having invalid cookies.
 * Sets cookie_valid=false and increments failed_attempts.
 */
export async function markAccountInvalid(accountId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_failed_attempts', { account_id: accountId });

  // Fallback: if RPC doesn't exist, use direct update
  if (error) {
    await supabase
      .from('scrapper_accounts')
      .update({ cookie_valid: false })
      .eq('id', accountId);

    // Increment failed_attempts separately (Supabase doesn't support increment in update)
    const { data: account } = await supabase
      .from('scrapper_accounts')
      .select('failed_attempts')
      .eq('id', accountId)
      .single();

    if (account) {
      await supabase
        .from('scrapper_accounts')
        .update({ failed_attempts: (account.failed_attempts || 0) + 1 })
        .eq('id', accountId);
    }
  }

  console.log(`[account-selector] Marked account ${accountId} as invalid`);
}

/**
 * isCookieError() — Detect Instagram login redirect errors.
 * Returns true if the error indicates the session cookies are invalid.
 */
export function isCookieError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('accounts/login') ||
    message.includes('login_required') ||
    message.includes('Log in') ||
    message.includes('LoginRequired')
  );
}

/**
 * isNoAccountsAvailable() — Check if selectAccount returned null.
 * Convenience wrapper for clarity in worker code.
 */
export function isNoAccountsAvailable(account: Account | null): account is null {
  return account === null;
}

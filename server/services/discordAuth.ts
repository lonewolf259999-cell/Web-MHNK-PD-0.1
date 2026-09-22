/* Discord OAuth2 — login redirect and code exchange */

import { config } from '@/server/config';

/**
 * Must match a redirect registered in the Discord Developer Portal
 * character for character. A trailing slash on APP_URL would otherwise
 * produce a double slash here and Discord would reject every login.
 */
export function redirectUri(): string {
  return `${config.APP_URL.replace(/\/+$/, '')}/auth/discord/callback`;
}

/** Where to send the browser back to after auth, keyed by the state param. */
export function fallbackPage(state: string | null): string {
  if (state === 'medical') return '/medical';
  if (state === 'admin') return '/proctor';
  if (state === 'roster') return '/rostermanage';
  if (state?.startsWith('map')) return '/MapMhnkPD';
  return '/register';
}

export function authUrl(state: string): string {
  if (!config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET) {
    throw new Error('Discord OAuth is not configured');
  }

  const params = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'identify',
    prompt: 'consent',
  });

  if (state) params.set('state', state);

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }),
    signal: AbortSignal.timeout(config.REQUEST_TIMEOUT),
  });

  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
    error_description?: string;
  } | null;

  if (!json?.access_token) {
    throw new Error(json?.error_description || 'Failed to get access token');
  }
  return json.access_token;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  displayName: string;
}

export async function getUserInfo(accessToken: string): Promise<DiscordUser> {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(config.REQUEST_TIMEOUT),
  });

  const json = (await res.json().catch(() => null)) as {
    id?: string;
    username?: string;
    discriminator?: string;
    avatar?: string;
    global_name?: string;
  } | null;

  if (!json?.id) throw new Error('Failed to get user info');

  return {
    id: json.id,
    username: json.username ?? '',
    discriminator: json.discriminator ?? '0',
    avatar: json.avatar ?? '',
    displayName: json.global_name || json.username || '',
  };
}

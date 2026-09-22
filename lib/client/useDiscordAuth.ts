'use client';

import { useEffect, useState } from 'react';

export interface DiscordUser {
  /** Numeric snowflake — what the API stores and mentions. */
  userId: string;
  name: string;
  avatarHash: string;
}

export interface DiscordAuthState {
  user: DiscordUser | null;
  failed: boolean;
  loginUrl: string;
  disconnect: () => void;
  avatarUrl: string | null;
}

/**
 * Reads the Discord identity the OAuth callback appended to the URL, then
 * strips those params so a refresh or shared link cannot replay them.
 */
export function useDiscordAuth(state: string): DiscordAuthState {
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('auth');
    if (!status) return;

    const userId = params.get('discord_userId');
    if (status === 'success' && userId) {
      setUser({
        userId,
        name: params.get('discord_name') ?? '',
        avatarHash: params.get('discord_avatar') ?? '',
      });
    } else if (status === 'failed') {
      setFailed(true);
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  const avatarUrl = user
    ? user.avatarHash
      ? `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatarHash}.png?size=64`
      : 'https://cdn.discordapp.com/embed/avatars/0.png'
    : null;

  return {
    user,
    failed,
    loginUrl: `/auth/discord?state=${encodeURIComponent(state)}`,
    disconnect: () => setUser(null),
    avatarUrl,
  };
}

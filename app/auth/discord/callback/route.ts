import { NextResponse } from 'next/server';
import { exchangeCode, fallbackPage, getUserInfo } from '@/server/services/discordAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get('state');
  const back = fallbackPage(state);

  const code = params.get('code');
  if (params.get('error') || !code) {
    return NextResponse.redirect(new URL(`${back}?auth=failed`, request.url));
  }

  try {
    const user = await getUserInfo(await exchangeCode(code));

    // Legacy usernames carry a #1234 discriminator; modern ones use "0".
    const discordId =
      user.discriminator && user.discriminator !== '0'
        ? `${user.username}#${user.discriminator}`
        : user.username;

    const result = new URLSearchParams({
      discord_id: discordId,
      discord_userId: user.id,
      discord_name: user.displayName,
      discord_avatar: user.avatar,
      auth: 'success',
    });

    return NextResponse.redirect(new URL(`${back}?${result.toString()}`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`${back}?auth=failed`, request.url));
  }
}

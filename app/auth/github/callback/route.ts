import { SESSION_MAX_AGE, createSession, readCookie, safeEqual, serializeCookie } from '@/lib/auth';
import { SESSION_COOKIE, STATE_COOKIE } from '@/lib/authCookies';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

type GitHubUser = { id: number; login: string; avatar_url: string };

function redirect(req: Request, path: string, cookies: string[]): Response {
  const headers = new Headers({ Location: new URL(path, req.url).toString() });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

async function fetchGitHubUser(code: string, redirectUri: string): Promise<GitHubUser | null> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) return null;
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
  if (!accessToken) return null;

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'todo-app',
    },
  });
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as Partial<GitHubUser>;
  if (typeof user.id !== 'number' || typeof user.login !== 'string') return null;
  return { id: user.id, login: user.login, avatar_url: user.avatar_url ?? '' };
}

// GET /auth/github/callback?code=&state=
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = readCookie(req, STATE_COOKIE);
  const clearState = serializeCookie(STATE_COOKIE, '', 0, '/auth/github');

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return redirect(req, '/login?error=state', [clearState]);
  }
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return redirect(req, '/login?error=config', [clearState]);
  }

  try {
    const profile = await fetchGitHubUser(code, new URL('/auth/github/callback', req.url).toString());
    if (!profile) return redirect(req, '/login?error=github', [clearState]);

    await connectDB();
    const user = await User.findOneAndUpdate(
      { githubId: profile.id },
      { username: profile.login, avatarUrl: profile.avatar_url },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    const token = await createSession(user._id);
    return redirect(req, '/', [clearState, serializeCookie(SESSION_COOKIE, token, SESSION_MAX_AGE)]);
  } catch {
    return redirect(req, '/login?error=server', [clearState]);
  }
}

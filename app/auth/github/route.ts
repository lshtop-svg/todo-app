import { randomToken, serializeCookie } from '@/lib/auth';
import { STATE_COOKIE } from '@/lib/authCookies';

export const dynamic = 'force-dynamic';

const STATE_MAX_AGE = 60 * 10; // 10분

// GET /auth/github → GitHub 인증 페이지로 리다이렉트 (CSRF 방지용 state 쿠키 설정)
export async function GET(req: Request): Promise<Response> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: 'GITHUB_CLIENT_ID 환경 변수가 설정되지 않았습니다' }, { status: 500 });
  }
  const state = randomToken();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', new URL('/auth/github/callback', req.url).toString());
  authorize.searchParams.set('scope', 'read:user');
  authorize.searchParams.set('state', state);

  const headers = new Headers({ Location: authorize.toString() });
  headers.append('Set-Cookie', serializeCookie(STATE_COOKIE, state, STATE_MAX_AGE, '/auth/github'));
  return new Response(null, { status: 302, headers });
}

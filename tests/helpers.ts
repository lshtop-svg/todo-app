import { createSession } from '@/lib/auth';
import { SESSION_COOKIE } from '@/lib/authCookies';
import { User } from '@/models/User';

type Handler<P> = (req: Request, ctx: { params: P }) => Promise<Response>;

let defaultCookie: string | undefined;

/** 이후 call() 에 기본으로 붙일 Cookie 헤더 (undefined 면 쿠키 없이 호출) */
export function authenticate(cookie: string | undefined): void {
  defaultCookie = cookie;
}

let nextGithubId = 1;

/** 테스트용 사용자 + 세션을 만들고 { userId, cookie } 를 반환 */
export async function loginAs(username: string): Promise<{ userId: string; cookie: string; token: string }> {
  const user = await User.create({ githubId: nextGithubId++, username, avatarUrl: `https://example.com/${username}.png` });
  const token = await createSession(user._id);
  return { userId: user._id.toString(), cookie: `${SESSION_COOKIE}=${token}`, token };
}

/** Route Handler 를 직접 호출하고 { status, body } 를 반환 */
export async function call<P = Record<string, string>>(
  handler: Handler<P>,
  options: { method?: string; url?: string; body?: unknown; params?: P; cookie?: string | null } = {},
): Promise<{ status: number; body: any }> {
  const { method = 'GET', url = 'http://localhost/api', body, params = {} as P } = options;
  const cookie = options.cookie === undefined ? defaultCookie : options.cookie ?? undefined;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const req = new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const res = await handler(req, { params });
  return { status: res.status, body: await res.json() };
}

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as githubRoute from '@/app/auth/github/route';
import * as callbackRoute from '@/app/auth/github/callback/route';
import * as logoutRoute from '@/app/auth/logout/route';
import * as goalsRoute from '@/app/api/goals/route';
import * as goalRoute from '@/app/api/goals/[id]/route';
import * as weeklyRoute from '@/app/api/weekly/route';
import * as weeklyItemRoute from '@/app/api/weekly/[id]/route';
import * as todosRoute from '@/app/api/todos/route';
import * as todoRoute from '@/app/api/todos/[id]/route';
import { hashToken } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Session } from '@/models/Session';
import { User } from '@/models/User';
import { authenticate, call, loginAs } from './helpers';

// 실제 값이 아닌 테스트 전용 더미 값 (실제 GitHub 은 호출하지 않음)
const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';
const ID = '507f1f77bcf86cd799439011';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('auth-test');
  await connectDB();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  authenticate(undefined);
  vi.stubEnv('GITHUB_CLIENT_ID', TEST_CLIENT_ID);
  vi.stubEnv('GITHUB_CLIENT_SECRET', TEST_CLIENT_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function setCookies(res: Response): string[] {
  return res.headers.getSetCookie();
}

function cookieValue(res: Response, name: string): string | undefined {
  const cookie = setCookies(res).find((c) => c.startsWith(`${name}=`));
  return cookie?.split(';')[0].slice(name.length + 1);
}

type GitHubProfile = { id: number; login: string; avatar_url: string };

/** GitHub 토큰/사용자 엔드포인트를 흉내내는 fetch mock */
function mockGitHub(profile: GitHubProfile) {
  const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === 'https://github.com/login/oauth/access_token') {
      return Response.json({ access_token: 'gho_test_access_token', token_type: 'bearer' });
    }
    if (url === 'https://api.github.com/user') return Response.json(profile);
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function callback(query: string, stateCookie?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (stateCookie) headers.Cookie = `oauth_state=${stateCookie}`;
  return callbackRoute.GET(new Request(`http://localhost:3000/auth/github/callback${query}`, { headers }));
}

async function login(profile: GitHubProfile): Promise<Response> {
  mockGitHub(profile);
  return callback('?code=test-code&state=abc123', 'abc123');
}

describe('GET /auth/github', () => {
  it('state 쿠키를 설정하고 GitHub authorize 로 302 리다이렉트', async () => {
    const res = await githubRoute.GET(new Request('http://localhost:3000/auth/github'));
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(location.searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
    expect(location.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/github/callback');
    const state = location.searchParams.get('state');
    expect(state).toMatch(/^[a-f0-9]{64}$/);

    const stateCookie = setCookies(res).find((c) => c.startsWith('oauth_state='))!;
    expect(cookieValue(res, 'oauth_state')).toBe(state);
    expect(stateCookie).toContain('HttpOnly');
    expect(stateCookie).toContain('SameSite=Lax');
  });

  it('요청마다 다른 state 를 생성', async () => {
    const a = await githubRoute.GET(new Request('http://localhost:3000/auth/github'));
    const b = await githubRoute.GET(new Request('http://localhost:3000/auth/github'));
    expect(cookieValue(a, 'oauth_state')).not.toBe(cookieValue(b, 'oauth_state'));
  });
});

describe('GET /auth/github/callback', () => {
  const profile = { id: 4242, login: 'octocat', avatar_url: 'https://avatars.example.com/u/4242' };

  it.each([
    ['state 누락', '?code=test-code', 'abc123'],
    ['state 불일치', '?code=test-code&state=evil', 'abc123'],
    ['state 쿠키 없음', '?code=test-code&state=abc123', undefined],
    ['code 누락', '?state=abc123', 'abc123'],
  ])('%s → 세션을 만들지 않고 /login 으로 리다이렉트', async (_name, query, stateCookie) => {
    const fetchMock = mockGitHub(profile);
    const res = await callback(query, stateCookie);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    expect(cookieValue(res, 'session')).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await Session.countDocuments()).toBe(0);
    expect(await User.countDocuments()).toBe(0);
  });

  it('정상 콜백: 사용자 upsert + 해시된 세션 저장 + httpOnly/lax 쿠키', async () => {
    const fetchMock = mockGitHub(profile);
    const res = await callback('?code=test-code&state=abc123', 'abc123');
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');

    // 토큰 교환에 환경 변수의 client id/secret 과 code 를 사용
    const tokenCall = fetchMock.mock.calls.find(([url]) => String(url) === 'https://github.com/login/oauth/access_token')!;
    const sent = JSON.parse(String(tokenCall[1]?.body));
    expect(sent).toMatchObject({ client_id: TEST_CLIENT_ID, client_secret: TEST_CLIENT_SECRET, code: 'test-code' });

    const users = await User.find().lean();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ githubId: 4242, username: 'octocat', avatarUrl: profile.avatar_url });

    const sessionCookie = setCookies(res).find((c) => c.startsWith('session='))!;
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
    const token = cookieValue(res, 'session')!;
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    const sessions = await Session.find().lean();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(hashToken(token));
    expect(sessions[0].tokenHash).not.toBe(token);
    expect(sessions[0].userId.toString()).toBe(users[0]._id.toString());
    expect(sessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    // DB 어디에도 원본 토큰이 저장되지 않음
    expect(await Session.countDocuments({ tokenHash: token })).toBe(0);
    expect(JSON.stringify(sessions)).not.toContain(token);

    // state 쿠키는 제거
    expect(setCookies(res).find((c) => c.startsWith('oauth_state='))).toContain('Max-Age=0');

    // 발급된 쿠키로 API 접근 가능
    expect((await call(todosRoute.GET, { cookie: `session=${token}` })).status).toBe(200);
  });

  it('같은 GitHub 사용자가 두 번 로그인하면 기존 User 를 갱신 (중복 없음)', async () => {
    await login(profile);
    await login({ ...profile, login: 'octocat-renamed', avatar_url: 'https://avatars.example.com/new' });
    const users = await User.find().lean();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      githubId: 4242,
      username: 'octocat-renamed',
      avatarUrl: 'https://avatars.example.com/new',
    });
    expect(await Session.countDocuments({ userId: users[0]._id })).toBe(2);
  });

  it('GitHub 토큰 교환 실패 시 세션을 만들지 않음', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'bad_verification_code' })));
    const res = await callback('?code=bad&state=abc123', 'abc123');
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    expect(await Session.countDocuments()).toBe(0);
    expect(await User.countDocuments()).toBe(0);
  });
});

describe('인증되지 않은 API 접근', () => {
  const body = { title: 'x', weekStart: '2024-09-02', status: 'done', goalIndex: 0, done: true };
  const handlers: [string, (req: Request, ctx: { params: { id: string } }) => Promise<Response>][] = [
    ['GET /api/todos', todosRoute.GET],
    ['POST /api/todos', todosRoute.POST],
    ['GET /api/todos/:id', todoRoute.GET],
    ['PUT /api/todos/:id', todoRoute.PUT],
    ['PATCH /api/todos/:id', todoRoute.PATCH],
    ['DELETE /api/todos/:id', todoRoute.DELETE],
    ['GET /api/goals', goalsRoute.GET],
    ['POST /api/goals', goalsRoute.POST],
    ['GET /api/goals/:id', goalRoute.GET],
    ['PUT /api/goals/:id', goalRoute.PUT],
    ['DELETE /api/goals/:id', goalRoute.DELETE],
    ['GET /api/weekly', weeklyRoute.GET],
    ['POST /api/weekly', weeklyRoute.POST],
    ['GET /api/weekly/:id', weeklyItemRoute.GET],
    ['PUT /api/weekly/:id', weeklyItemRoute.PUT],
    ['PATCH /api/weekly/:id', weeklyItemRoute.PATCH],
    ['DELETE /api/weekly/:id', weeklyItemRoute.DELETE],
  ];

  it('6개 라우트 파일의 모든 메서드를 export 목록과 대조', () => {
    const routes = [todosRoute, todoRoute, goalsRoute, goalRoute, weeklyRoute, weeklyItemRoute];
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const exported = routes.flatMap((route) => methods.filter((m) => m in route).map((m) => route[m as keyof typeof route]));
    expect(new Set(handlers.map(([, h]) => h))).toEqual(new Set(exported));
  });

  it.each(handlers)('%s → 쿠키 없으면 401 {error}', async (name, handler) => {
    const method = name.split(' ')[0];
    const res = await call(handler, { method, params: { id: ID }, body: method === 'GET' || method === 'DELETE' ? undefined : body });
    expect(res.status).toBe(401);
    expect(typeof res.body.error).toBe('string');
  });

  it('DB 에 없는 토큰 → 401', async () => {
    const res = await call(todosRoute.GET, { cookie: `session=${'f'.repeat(64)}` });
    expect(res.status).toBe(401);
  });

  it('만료된 세션 → 401', async () => {
    const { cookie, token } = await loginAs('expired');
    await Session.updateOne({ tokenHash: hashToken(token) }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await call(todosRoute.GET, { cookie })).status).toBe(401);
  });

  it('세션은 있으나 사용자가 삭제됨 → 401', async () => {
    const { cookie, userId } = await loginAs('ghost');
    await User.deleteOne({ _id: userId });
    expect((await call(todosRoute.GET, { cookie })).status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('세션 문서 삭제 + 쿠키 제거 후 같은 토큰은 401', async () => {
    const { cookie, token } = await loginAs('leaver');
    expect((await call(todosRoute.GET, { cookie })).status).toBe(200);

    const res = await logoutRoute.POST(new Request('http://localhost:3000/auth/logout', { method: 'POST', headers: { Cookie: cookie } }));
    expect(res.status).toBe(200);
    const cleared = setCookies(res).find((c) => c.startsWith('session='))!;
    expect(cleared).toContain('Max-Age=0');
    expect(cookieValue(res, 'session')).toBe('');

    expect(await Session.countDocuments({ tokenHash: hashToken(token) })).toBe(0);
    expect((await call(todosRoute.GET, { cookie })).status).toBe(401);
  });

  it('다른 세션에는 영향 없음', async () => {
    const a = await loginAs('a');
    const b = await loginAs('b');
    await logoutRoute.POST(new Request('http://localhost:3000/auth/logout', { method: 'POST', headers: { Cookie: a.cookie } }));
    expect((await call(todosRoute.GET, { cookie: b.cookie })).status).toBe(200);
  });

  it('DB 오류로 세션 삭제가 실패하면 500 이지만 쿠키는 제거', async () => {
    const { cookie } = await loginAs('failing');
    const deleteOne = vi.spyOn(Session, 'deleteOne').mockRejectedValue(new Error('db down'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const res = await logoutRoute.POST(new Request('http://localhost:3000/auth/logout', { method: 'POST', headers: { Cookie: cookie } }));
      expect(res.status).toBe(500);
      expect(setCookies(res).find((c) => c.startsWith('session='))).toContain('Max-Age=0');
      expect((await res.json()).error).toBeTruthy();
      expect(deleteOne).toHaveBeenCalled();
    } finally {
      deleteOne.mockRestore();
      errorLog.mockRestore();
    }
  });

  it('쿠키 없이 호출해도 쿠키 제거 응답', async () => {
    const res = await logoutRoute.POST(new Request('http://localhost:3000/auth/logout', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(setCookies(res).find((c) => c.startsWith('session='))).toContain('Max-Age=0');
  });
});

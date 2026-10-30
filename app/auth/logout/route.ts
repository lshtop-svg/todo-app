import { deleteSession, readCookie, serializeCookie } from '@/lib/auth';
import { SESSION_COOKIE } from '@/lib/authCookies';

export const dynamic = 'force-dynamic';

// POST /auth/logout → 세션 문서 삭제 + 쿠키 제거
// 삭제에 실패해도 쿠키는 항상 제거하되, 500 으로 실패를 알린다 (세션 문서가 남아 있으므로).
export async function POST(req: Request): Promise<Response> {
  const token = readCookie(req, SESSION_COOKIE);
  let failed = false;
  if (token) {
    try {
      await deleteSession(token);
    } catch (error) {
      failed = true;
      // 토큰 등 민감 정보는 남기지 않고 오류 종류만 기록
      console.error('logout: 세션 삭제 실패', error instanceof Error ? error.name : 'UnknownError');
    }
  }
  return Response.json(failed ? { error: '로그아웃 처리에 실패했습니다' } : { ok: true }, {
    status: failed ? 500 : 200,
    headers: { 'Set-Cookie': serializeCookie(SESSION_COOKIE, '', 0) },
  });
}

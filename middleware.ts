import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/authCookies';

// Edge 런타임에서는 DB 를 쓸 수 없으므로 쿠키 존재 여부만 확인한다.
// 세션 유효성은 (main) 레이아웃과 API 의 requireUser 에서 검증한다.
export function middleware(req: NextRequest) {
  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|auth|login|_next/static|_next/image|favicon.ico).*)'],
};

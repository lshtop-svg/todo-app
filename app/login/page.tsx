import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserFromToken } from '@/lib/auth';
import { SESSION_COOKIE } from '@/lib/authCookies';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  state: '로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.',
  github: 'GitHub 인증에 실패했습니다. 다시 시도해 주세요.',
  config: '서버에 GitHub OAuth 설정이 없습니다. 관리자에게 문의하세요.',
  server: '로그인 처리 중 서버 오류가 발생했습니다.',
};

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token && (await getUserFromToken(token))) redirect('/');

  const error = searchParams.error ? (ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.server) : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-bold text-indigo-600">📋 플랜 투 두</h1>
        <p className="text-sm text-gray-600">할일과 계획을 관리하려면 로그인하세요.</p>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <a
          href="/auth/github"
          className="block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          GitHub로 로그인
        </a>
      </div>
    </div>
  );
}

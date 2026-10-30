import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { getUserFromToken } from '@/lib/auth';
import { SESSION_COOKIE } from '@/lib/authCookies';

// 세션 실제 검증은 서버에서 수행 (middleware 는 쿠키 존재 여부만 확인)
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const user = token ? await getUserFromToken(token) : null;
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={{ username: user.username, avatarUrl: user.avatarUrl }} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

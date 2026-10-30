'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatWeekRange, getWeekStart } from '@/lib/utils';
import { resetStore } from '@/store';
import { NAV_ITEMS, isActive } from './Sidebar';

type HeaderUser = { username: string; avatarUrl: string };

export default function Header({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const current = [...NAV_ITEMS].reverse().find((item) => isActive(pathname, item.href));

  const logout = async () => {
    setLoggingOut(true);
    setError('');
    const res = await fetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    if (!res?.ok) {
      setError('로그아웃에 실패했습니다. 다시 시도하세요.');
      setLoggingOut(false);
      return;
    }
    resetStore();
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
      <h1 className="text-lg font-semibold">{current?.label ?? '플랜 투 두'}</h1>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-gray-500 sm:inline" suppressHydrationWarning>
          이번 주 {formatWeekRange(getWeekStart())}
        </span>
        <span className="flex items-center gap-2 text-sm font-medium">
          {user.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
          )}
          {user.username}
        </span>
        <button
          type="button"
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          onClick={logout}
          disabled={loggingOut}
        >
          로그아웃
        </button>
        {error && (
          <span role="alert" className="text-sm text-red-600">
            {error}
          </span>
        )}
      </div>
    </header>
  );
}

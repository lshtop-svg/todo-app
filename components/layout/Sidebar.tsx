'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS = [
  { href: '/', label: '대시보드' },
  { href: '/todos', label: '할일 보드' },
  { href: '/weekly', label: '주간 계획' },
  { href: '/goals', label: '1년 목표' },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-gray-200 bg-white md:w-56 md:shrink-0 md:border-b-0 md:border-r">
      <div className="hidden px-5 py-5 text-lg font-bold text-indigo-600 md:block">📋 플랜 투 두</div>
      {/* 모바일: 가로 탭 / 데스크톱: 세로 메뉴 */}
      <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:px-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
              isActive(pathname, item.href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

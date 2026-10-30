import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '할일 + 계획 관리',
  description: '할일, 주간 계획, 1년 목표를 연결해 관리하는 앱',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

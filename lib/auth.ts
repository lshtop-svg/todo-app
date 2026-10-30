import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';
import { ApiError } from './api';
import { SESSION_COOKIE } from './authCookies';
import { connectDB } from './mongodb';
import { Session } from '@/models/Session';
import { User } from '@/models/User';

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일 (초)

export type SessionUser = { _id: Types.ObjectId; username: string; avatarUrl: string };

export function randomToken(): string {
  return randomBytes(32).toString('hex');
}

/** DB 에는 원본 토큰 대신 SHA-256 해시만 저장한다 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function serializeCookie(name: string, value: string, maxAge: number, path = '/'): string {
  const parts = [`${name}=${value}`, `Path=${path}`, `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim() || undefined;
  }
  return undefined;
}

/** 세션을 만들고 쿠키에 넣을 원본 토큰을 반환 */
export async function createSession(userId: Types.ObjectId): Promise<string> {
  const token = randomToken();
  await Session.create({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
  });
  return token;
}

/** 유효한(존재하고 만료되지 않은) 세션의 사용자, 없으면 null */
export async function getUserFromToken(token: string): Promise<SessionUser | null> {
  await connectDB();
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId, { username: 1, avatarUrl: 1 }).lean();
  return user ? { _id: user._id, username: user.username, avatarUrl: user.avatarUrl } : null;
}

export async function deleteSession(token: string): Promise<void> {
  await connectDB();
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

/** API Route 용: 세션 사용자 id 를 반환하고, 없으면 401 */
export async function requireUser(req: Request): Promise<Types.ObjectId> {
  const token = readCookie(req, SESSION_COOKIE);
  const user = token ? await getUserFromToken(token) : null;
  if (!user) throw new ApiError(401, '로그인이 필요합니다');
  return user._id;
}

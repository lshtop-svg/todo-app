import { describe, expect, it } from 'vitest';
import * as goalsRoute from '@/app/api/goals/route';
import { authenticate, call } from './helpers';

describe('DB 연결 실패', () => {
  // 세션 쿠키가 있어야 인증 단계에서 DB 에 접근한다
  authenticate('session=test-token');

  it('MONGODB_URI 가 없으면 500', async () => {
    delete process.env.MONGODB_URI;
    const res = await call(goalsRoute.GET);
    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });

  it('연결할 수 없는 URI 면 500', async () => {
    process.env.MONGODB_URI = 'not-a-mongodb-uri';
    const res = await call(goalsRoute.GET);
    expect(res.status).toBe(500);
  });
});

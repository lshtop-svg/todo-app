import { Types } from 'mongoose';
import { ZodError } from 'zod';
import { objectId } from './validation';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Context<P> = { params: P };

/** Route Handler 공통 에러 처리: 400 / 404 / 409 / 500 */
export function handle<P = Record<string, string>>(
  fn: (req: Request, ctx: Context<P>) => Promise<Response>,
) {
  return async (req: Request, ctx: Context<P>): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
      if (error instanceof ZodError) {
        return Response.json({ error: error.issues[0]?.message ?? '잘못된 요청입니다' }, { status: 400 });
      }
      if (error instanceof SyntaxError) return Response.json({ error: '잘못된 JSON 형식입니다' }, { status: 400 });
      if ((error as { code?: number }).code === 11000) {
        return Response.json({ error: '이미 존재하는 데이터입니다' }, { status: 409 });
      }
      console.error(error);
      return Response.json({ error: '서버 오류가 발생했습니다 (DB 연결을 확인하세요)' }, { status: 500 });
    }
  };
}

export function parseId(id: string): string {
  const result = objectId.safeParse(id);
  if (!result.success) throw new ApiError(400, '잘못된 ID 형식입니다');
  return result.data;
}

export function notFound(what: string): never {
  throw new ApiError(404, `${what}을(를) 찾을 수 없습니다`);
}

/** lean() 결과를 JSON 응답 형태로 변환: ObjectId → string, Date → ISO, __v 제거 */
export function toJSON<T = unknown>(value: unknown): T {
  return convert(value) as T;
}

function convert(value: unknown): unknown {
  if (value instanceof Types.ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(convert);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (key !== '__v') out[key] = convert(v);
    }
    return out;
  }
  return value;
}

export function searchParams(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams);
}

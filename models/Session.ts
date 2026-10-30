import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface ISession {
  /** 쿠키에 담긴 토큰의 SHA-256 해시 (원본 토큰은 저장하지 않음) */
  tokenHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // TTL 인덱스: 만료 시각이 지나면 MongoDB 가 문서를 자동 삭제
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true },
);

export const Session: Model<ISession> =
  (models.Session as Model<ISession>) || model<ISession>('Session', SessionSchema);

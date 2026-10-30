import { Schema, model, models, type Model, type Types } from 'mongoose';
import { MAX_WEEKLY_GOALS } from '@/types';

export interface IWeeklyPlan {
  userId: Types.ObjectId;
  weekStart: Date;
  goals: { text: string; done: boolean }[];
  memo: string;
  retrospective: string;
  goalId?: Types.ObjectId | null;
}

const WeeklyGoalSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const WeeklyPlanSchema = new Schema<IWeeklyPlan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    weekStart: { type: Date, required: true },
    goals: {
      type: [WeeklyGoalSchema],
      default: [],
      validate: {
        validator: (v: unknown[]) => v.length <= MAX_WEEKLY_GOALS,
        message: `주간 목표는 최대 ${MAX_WEEKLY_GOALS}개입니다`,
      },
    },
    memo: { type: String, default: '' },
    retrospective: { type: String, default: '' },
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', default: null },
  },
  { timestamps: true },
);

// 같은 주 중복 방지는 사용자별로 적용
WeeklyPlanSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

export const WeeklyPlan: Model<IWeeklyPlan> =
  (models.WeeklyPlan as Model<IWeeklyPlan>) || model<IWeeklyPlan>('WeeklyPlan', WeeklyPlanSchema);

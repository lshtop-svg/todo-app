import { Schema, model, models, type Model, type Types } from 'mongoose';
import { PRIORITIES, TODO_STATUSES, type Priority, type TodoStatus } from '@/types';

export interface ITodo {
  userId: Types.ObjectId;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: Priority;
  dueDate?: Date | null;
  dayOfWeek?: number | null;
  order: string;
  weeklyPlanId?: Types.ObjectId | null;
  goalId?: Types.ObjectId | null;
}

const TodoSchema = new Schema<ITodo>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: TODO_STATUSES, default: 'todo' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    dueDate: { type: Date, default: null },
    dayOfWeek: { type: Number, min: 0, max: 6, default: null },
    order: { type: String, required: true },
    weeklyPlanId: { type: Schema.Types.ObjectId, ref: 'WeeklyPlan', default: null },
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', default: null },
  },
  { timestamps: true },
);

TodoSchema.index({ status: 1, order: 1 });

export const Todo: Model<ITodo> = (models.Todo as Model<ITodo>) || model<ITodo>('Todo', TodoSchema);

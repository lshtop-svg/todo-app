import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface IGoal {
  userId: Types.ObjectId;
  title: string;
  description: string;
  progress: number;
}

const GoalSchema = new Schema<IGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true },
);

export const Goal: Model<IGoal> = (models.Goal as Model<IGoal>) || model<IGoal>('Goal', GoalSchema);

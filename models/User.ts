import { Schema, model, models, type Model } from 'mongoose';

export interface IUser {
  githubId: number;
  username: string;
  avatarUrl: string;
}

const UserSchema = new Schema<IUser>(
  {
    githubId: { type: Number, required: true, unique: true },
    username: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
  },
  { timestamps: true },
);

export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>('User', UserSchema);

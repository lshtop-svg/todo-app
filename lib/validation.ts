import { z } from 'zod';
import { MAX_WEEKLY_GOALS } from '@/types';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, '잘못된 ID 형식입니다');
const optionalRef = objectId.nullable().optional();
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 입니다');

const status = z.enum(['todo', 'doing', 'done']);
const priority = z.enum(['high', 'medium', 'low']);

export const goalSchema = z.object({
  title: z.string().trim().min(1, '제목은 필수입니다').max(100),
  description: z.string().max(1000).optional().default(''),
});

export const weeklySchema = z.object({
  weekStart: dateKey,
  goals: z
    .array(z.object({ text: z.string().trim().min(1).max(200), done: z.boolean().default(false) }))
    .max(MAX_WEEKLY_GOALS, `주간 목표는 최대 ${MAX_WEEKLY_GOALS}개입니다`)
    .default([]),
  memo: z.string().max(5000).optional().default(''),
  retrospective: z.string().max(5000).optional().default(''),
  goalId: optionalRef,
});

export const weeklyPatchSchema = z.object({
  goalIndex: z.number().int().min(0),
  done: z.boolean(),
});

export const weeklyQuerySchema = z.object({
  weekStart: dateKey.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const todoSchema = z.object({
  title: z.string().trim().min(1, '제목은 필수입니다').max(200),
  description: z.string().max(2000).optional().default(''),
  status: status.optional().default('todo'),
  priority: priority.optional().default('medium'),
  dueDate: dateKey.nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  weeklyPlanId: optionalRef,
  goalId: optionalRef,
});

export const todoPatchSchema = z
  .object({
    status: status.optional(),
    order: z.string().min(1).max(200).optional(),
  })
  .refine((v) => v.status !== undefined || v.order !== undefined, 'status 또는 order 가 필요합니다');

export const todoQuerySchema = z.object({
  status: status.optional(),
  weeklyPlanId: objectId.optional(),
  goalId: objectId.optional(),
});

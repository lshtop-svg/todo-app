import { describe, expect, it } from 'vitest';
import {
  getWeekStart,
  goalProgress,
  isOverdue,
  sortColumn,
  weekStartToUTC,
  weeklyProgress,
} from '@/lib/utils';
import { compareKeys, keyAfter, keyBetween, needsRebalance, rebalancedKeys } from '@/lib/fractionalIndex';
import type { Todo } from '@/types';

describe('getWeekStart (월요일 시작)', () => {
  it('월요일은 그대로', () => {
    expect(getWeekStart(new Date(2024, 8, 2, 0, 0))).toBe('2024-09-02');
  });
  it('일요일은 직전 월요일', () => {
    expect(getWeekStart(new Date(2024, 8, 8, 23, 59))).toBe('2024-09-02');
  });
  it('주중은 같은 주 월요일', () => {
    expect(getWeekStart(new Date(2024, 8, 4, 12))).toBe('2024-09-02');
  });
  it('월 경계를 넘는다', () => {
    expect(getWeekStart(new Date(2024, 9, 1))).toBe('2024-09-30'); // 10/1(화)
    expect(getWeekStart(new Date(2024, 8, 1))).toBe('2024-08-26'); // 9/1(일)
  });
  it('연 경계를 넘는다', () => {
    expect(getWeekStart(new Date(2025, 0, 1))).toBe('2024-12-30');
  });
  it('서버 정규화(weekStartToUTC)도 같은 월요일', () => {
    expect(weekStartToUTC('2024-09-08').toISOString()).toBe('2024-09-02T00:00:00.000Z');
    expect(weekStartToUTC('2024-09-02').toISOString()).toBe('2024-09-02T00:00:00.000Z');
    expect(weekStartToUTC('2024-10-01').toISOString()).toBe('2024-09-30T00:00:00.000Z');
  });
});

describe('fractional index', () => {
  it('append', () => {
    const a = keyAfter(null);
    const b = keyAfter(a);
    expect(a).toBe('a0');
    expect(compareKeys(a, b)).toBe(-1);
  });
  it('between', () => {
    const k = keyBetween('a0', 'a1');
    expect(k > 'a0' && k < 'a1').toBe(true);
    expect(keyBetween(null, 'a0') < 'a0').toBe(true);
    expect(keyBetween('a0', null) > 'a0').toBe(true);
  });
  it('반복 삽입해도 순서를 유지', () => {
    let lo = 'a0';
    const hi = 'a1';
    let i = 0;
    while (!needsRebalance(lo) && i < 1000) {
      const k = keyBetween(lo, hi);
      expect(lo < k && k < hi).toBe(true);
      lo = k;
      i++;
    }
    // 같은 위치에 계속 삽입하면 결국 재정규화 임계값에 도달한다
    expect(needsRebalance(lo)).toBe(true);
  });
  it('a >= b 이상 데이터는 a 뒤로', () => {
    expect(keyBetween('a1', 'a1') > 'a1').toBe(true);
  });
  it('재정규화 키는 짧고 오름차순', () => {
    const keys = rebalancedKeys(5);
    expect([...keys].sort(compareKeys)).toEqual(keys);
    expect(keys.every((k) => !needsRebalance(k))).toBe(true);
  });
});

const todo = (over: Partial<Todo>): Todo => ({
  _id: Math.random().toString(),
  title: 't',
  status: 'todo',
  priority: 'medium',
  order: 'a0',
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('진행률 / 정렬 / 마감일', () => {
  it('weeklyProgress', () => {
    expect(weeklyProgress([])).toBe(0);
    expect(weeklyProgress([{ text: 'a', done: true }, { text: 'b', done: false }, { text: 'c', done: false }])).toBe(33);
  });
  it('goalProgress', () => {
    const todos = [todo({ goalId: 'g', status: 'done' }), todo({ goalId: 'g' }), todo({ goalId: 'x', status: 'done' })];
    expect(goalProgress('g', todos)).toBe(50);
    expect(goalProgress('none', todos)).toBe(0);
  });
  it('sortColumn: High 우선순위는 상단 고정, 나머지는 order 순', () => {
    const sorted = sortColumn([
      todo({ _id: '1', order: 'a0' }),
      todo({ _id: '2', order: 'a2', priority: 'high' }),
      todo({ _id: '3', order: 'Zz', priority: 'low' }),
      todo({ _id: '4', order: 'a1', priority: 'high' }),
    ]);
    expect(sorted.map((t) => t._id)).toEqual(['4', '2', '3', '1']);
  });
  it('isOverdue', () => {
    expect(isOverdue({ dueDate: '2024-09-01T00:00:00.000Z', status: 'todo' }, '2024-09-02')).toBe(true);
    expect(isOverdue({ dueDate: '2024-09-02T00:00:00.000Z', status: 'todo' }, '2024-09-02')).toBe(false);
    expect(isOverdue({ dueDate: '2024-09-01T00:00:00.000Z', status: 'done' }, '2024-09-02')).toBe(false);
    expect(isOverdue({ dueDate: null, status: 'todo' }, '2024-09-02')).toBe(false);
  });
});

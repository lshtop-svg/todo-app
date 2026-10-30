import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

// 키 길이가 이 값을 넘으면 컬럼 전체 순서를 재정규화한다
export const REBALANCE_THRESHOLD = 24;

/**
 * 두 키 사이의 새 키를 생성한다. null 은 양 끝(처음/마지막)을 뜻한다.
 * 데이터 이상으로 a >= b 인 경우에는 a 뒤에 붙인다.
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) return generateKeyBetween(a, null);
  return generateKeyBetween(a, b);
}

/** 목록 마지막 키 뒤에 추가할 키 */
export function keyAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}

export function needsRebalance(key: string): boolean {
  return key.length > REBALANCE_THRESHOLD;
}

/** n 개의 균등한 새 키 (재정규화용) */
export function rebalancedKeys(n: number): string[] {
  return generateNKeysBetween(null, null, n);
}

/** fractional index 는 바이트 순 비교가 필요하다 (localeCompare 사용 금지) */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

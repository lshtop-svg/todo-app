/**
 * 기존 데이터에 userId 를 채우는 마이그레이션.
 * 사용법: npm run migrate:user-id -- --github-username <GitHub 사용자명>
 *        npm run migrate:user-id -- --github-id <GitHub 숫자 ID>   (사용자명이 중복될 때)
 * MONGODB_URI 는 환경 변수 또는 .env.local / .env 에서 읽는다.
 */
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { MigrationError, migrateUserId } from '../lib/migrateUserId';

function parseOption(args: string[], name: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name) return args[i + 1];
    if (args[i].startsWith(`${name}=`)) return args[i].slice(name.length + 1);
  }
  return undefined;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const username = parseOption(args, '--github-username');
  const idArg = parseOption(args, '--github-id');
  if (idArg !== undefined && !/^\d+$/.test(idArg)) {
    process.stderr.write('--github-id 는 숫자여야 합니다\n');
    return 1;
  }
  const githubId = idArg === undefined ? undefined : Number(idArg);
  if (githubId === undefined && !username) {
    process.stderr.write(
      '사용법: npm run migrate:user-id -- --github-username <GitHub 사용자명> | --github-id <GitHub 숫자 ID>\n',
    );
    return 1;
  }

  // Next.js 와 같은 우선순위: 이미 설정된 환경 변수 > .env.local > .env
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    process.stderr.write('MONGODB_URI 환경 변수가 설정되지 않았습니다\n');
    return 1;
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    const result = await migrateUserId(githubId !== undefined ? { githubId } : { githubUsername: username! });
    process.stdout.write(
      `마이그레이션 완료 (사용자: ${githubId !== undefined ? `GitHub ID ${githubId}` : username})\n` +
        `- todos: ${result.todos}건\n- goals: ${result.goals}건\n- weeklyPlans: ${result.weeklyPlans}건\n` +
        `- 기존 weekStart unique 인덱스 삭제: ${result.droppedLegacyIndex ? '예' : '아니오 (이미 없음)'}\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`마이그레이션 실패: ${error instanceof MigrationError ? error.message : String(error)}\n`);
    return 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`마이그레이션 실패: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  },
);

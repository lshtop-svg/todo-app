참고 문서
PRD: docs/PRD.md
구현 계획: docs/PLAN.md
작업 전 반드시 위 문서를 읽고 시작할 것.

## Commands
- `npm run dev` — 개발 서버 (http://localhost:3000)
- `npm run build` / `npm start` — 프로덕션 빌드 / 실행
- `npm run lint` — ESLint (next lint)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — Vitest (mongodb-memory-server 사용, 실제 DB 불필요)
- `npm run migrate:user-id -- --github-username <name>` — 기존 데이터에 userId 부여 (docs/LOGIN-SETUP.md 참고)
- 환경 변수: `MONGODB_URI`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` 를 `.env.local`(또는 `.env`)에 설정. 형식은 `.env.example` 참고. 두 파일 모두 gitignore 대상.

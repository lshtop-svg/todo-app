# GitHub 로그인 설정 가이드

할일 앱은 GitHub OAuth 로 로그인하며, 로그인한 사용자는 본인의 할일·주간 계획·목표만 볼 수 있습니다.

## 1. GitHub OAuth App 만들기

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   (https://github.com/settings/developers)
2. 다음과 같이 입력합니다.
   | 항목 | 값 |
   | --- | --- |
   | Application name | 자유 (예: `todo-app (local)`) |
   | Homepage URL | `http://localhost:3000` |
   | Authorization callback URL | `http://localhost:3000/auth/github/callback` |
3. **Register application** 후 표시되는 **Client ID** 를 복사합니다.
4. **Generate a new client secret** 으로 Client secret 을 만들고 복사합니다. (다시 볼 수 없으니 바로 저장)

> 배포 환경에서는 그 도메인용 OAuth App 을 따로 만들고 callback URL 을 `https://<도메인>/auth/github/callback` 으로 지정하세요.

## 2. 환경 변수 설정

`.env.example` 을 참고해 프로젝트 루트의 `.env.local`(또는 `.env`)에 설정합니다. 두 파일 모두 gitignore 대상이며, 비밀 값은 코드에 직접 쓰지 않습니다.

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/todo-app
GITHUB_CLIENT_ID=<Client ID>
GITHUB_CLIENT_SECRET=<Client secret>
```

환경 변수를 바꾼 뒤에는 `npm run dev` 를 다시 시작하세요.

## 3. 기존 데이터 마이그레이션 (로그인 기능 도입 전 데이터가 있는 경우)

로그인 도입 후 모든 할일·주간 계획·목표는 `userId`(소유자)를 가져야 하며, 소유자가 없는 기존 데이터는 **어떤 사용자에게도 보이지 않습니다.**
또한 기존 `weekStart` 단독 unique 인덱스가 남아 있으면 기존 데이터와 같은 주의 주간 계획을 새로 만들 수 없습니다.
따라서 **기존 데이터를 사용하기 전에(새 데이터를 만들기 전에) 반드시 마이그레이션을 실행**해야 합니다.

마이그레이션은 GitHub 사용자명으로 DB 의 User 를 찾기 때문에 순서는 다음과 같습니다.

1. `npm run dev` 실행 → `http://localhost:3000/login` 에서 **GitHub로 로그인** (사용자 문서가 생성됨)
   - 이 시점에는 기존 데이터가 보이지 않는 것이 정상입니다. **아무 데이터도 만들지 말고** 바로 다음 단계로 갑니다.
2. 새 터미널에서 본인 GitHub 사용자명으로 실행:
   ```
   npm run migrate:user-id -- --github-username <GitHub 사용자명>
   ```
3. 브라우저를 새로고침하면 기존 데이터가 보입니다.

마이그레이션이 하는 일:
- `userId` 가 없는 Todo / Goal / WeeklyPlan 문서를 지정한 사용자 소유로 지정 (`updatedAt` 은 유지)
- 기존 `weekStart` 단독 unique 인덱스 삭제 후 `(userId, weekStart)` unique 인덱스 및 `userId` 인덱스 생성

참고:
- `MONGODB_URI` 는 이미 설정된 환경 변수 → `.env.local` → `.env` 순서로 읽습니다.
- 여러 번 실행해도 안전합니다(두 번째 실행부터는 0건 변경).
- GitHub 사용자명은 중복될 수 있습니다(변경/재사용). 같은 사용자명의 User 가 둘 이상이면 아무것도 바꾸지 않고 해당 `githubId` 목록과 함께 종료 코드 1 로 끝나며, 이때는 숫자 ID 로 지정합니다:
  ```
  npm run migrate:user-id -- --github-id <GitHub 숫자 ID>
  ```
- 지정한 사용자명이 DB 에 없으면 아무것도 바꾸지 않고 오류 메시지와 함께 종료 코드 1 로 끝납니다. 먼저 해당 계정으로 한 번 로그인하세요.
- 실행 전 Atlas 백업(스냅샷)을 권장합니다.
- 처음부터 데이터가 없는 새 DB 라면 마이그레이션은 필요 없습니다.

## 동작 방식 요약

- `GET /auth/github` → CSRF 방지용 `state` 를 httpOnly 쿠키에 저장하고 GitHub 인증 페이지로 이동
- `GET /auth/github/callback` → `state` 검증, code 를 access token 으로 교환, GitHub 사용자 정보(id, username, avatar_url)를 User 에 저장(GitHub 숫자 id 기준 upsert), 세션 생성
- 세션: 무작위 토큰을 httpOnly · SameSite=Lax(운영 환경에서는 Secure) 쿠키에 저장하고, DB(Session 컬렉션)에는 토큰의 SHA-256 해시만 저장. 7일 후 만료(TTL 인덱스로 자동 삭제)
- `POST /auth/logout` → Session 문서 삭제 + 쿠키 제거 (헤더의 로그아웃 버튼)
- 로그인하지 않으면 페이지는 `/login` 으로 리다이렉트, `/api/*` 는 401 응답

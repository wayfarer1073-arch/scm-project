# 재고관리 대시보드

3개 창고(서로 다른 품목군을 관리하는 독립 재고 Pool)에서 매일 추출하는 재고 Excel 스냅샷을 업로드하면
소진 추세·Coverage·예상 소진일·소진 가속/둔화·장기 정체·과잉재고 후보를 계산해 보여주는 사내 재고관리
대시보드입니다. 이 데이터는 **재고 Snapshot이며 판매 데이터가 아닙니다** — 모든 지표는 "추정 소진량",
"관측된 재고 증가"처럼 스냅샷만으로 확인 가능한 사실만 표현합니다.

업로드 캘린더의 **입고 특이사항**에 상품명 또는 상품코드와 실제 입고 수량을 함께 기록하면,
해당 스냅샷 구간의 추정 소진량을 `이전 가용재고 + 입고량 - 현재 가용재고`로 보정합니다.
Excel의 `입고대기` 수량은 실제 입고로 간주하지 않습니다.

재고 Excel은 컬럼 순서나 부가 컬럼과 무관하게 `상품코드`, `상품명`, `정상재고` 헤더만 있으면 업로드할 수
있습니다. `원가`와 `원가합`은 선택이며, 원가가 비어 있으면 동일 SKU의 날짜상 최근 원가를 이어받고
원가합이 비어 있으면 `유효 원가 × 정상재고`로 계산합니다. 그 외 Excel 컬럼은 저장하지 않습니다.

## 기술 스택

- Next.js (App Router) + TypeScript, Tailwind CSS, 수작성 shadcn 스타일 UI 컴포넌트(Radix 기반)
- Recharts, SheetJS(xlsx)
- **Prisma + PostgreSQL** + Auth.js(Credentials, JWT 세션) — Supabase 등 관리형 Postgres의 connection
  string을 `DATABASE_URL`에 그대로 넣으면 배포에도 사용할 수 있습니다.
- Vitest (도메인 계산/Excel 파서 유닛 테스트)

## 로컬 개발 환경 준비

1. PostgreSQL을 준비합니다 (로컬 설치 또는 Docker).
2. `.env.example`을 참고해 `.env`를 작성합니다 (`DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`).
3. 의존성 설치 및 마이그레이션:

   ```bash
   npm install
   npm run db:migrate     # 스키마 적용
   npm run db:init        # 창고 A/B/C, 기본 설정값 생성
   npm run db:create-admin -- --email admin@company.com --password admin1234 --name 관리자
   ```

4. (선택) 30/60/90일 이상 데이터가 필요한 기능을 실제 대기 없이 검증하려면 mock 스냅샷 히스토리를 생성합니다.
   실 데이터와는 `isMock` 플래그로 명확히 분리됩니다.

   ```bash
   npm run db:seed              # 이미 있으면 건너뜀
   npm run db:seed -- --force   # 기존 mock을 지우고 재생성
   ```

5. 개발 서버 실행 후 `/login`으로 접속합니다.

   ```bash
   npm run dev
   ```

## 테스트

```bash
npm run test        # 도메인 계산 로직 + Excel 파서/검증/export 유닛 테스트
npx tsc --noEmit     # 타입 체크
npm run build        # 프로덕션 빌드
```

## 디렉터리 구조

- `src/domain` — 순수 계산 로직(재고 KPI, Excel 파싱/검증/export). DB·Next.js에 의존하지 않아 유닛 테스트가 쉽습니다.
- `src/server` — Prisma 리포지토리, 서비스 레이어(분석 조립), Auth.js 설정.
- `src/app` — 라우트(페이지, API 핸들러).
- `src/components` — UI. `components/ui`는 shadcn 스타일 프리미티브.
- `prisma/schema.prisma` — 데이터 모델.
- `scripts/` — 운영/개발용 CLI 스크립트(관리자 생성, 초기 데이터, mock 시드).

## 배포 참고

- `DATABASE_URL`을 Supabase(또는 다른 관리형 Postgres) 커넥션 문자열로 바꾸고 `npm run db:migrate`를 실행하면 그대로 배포할 수 있습니다.
- `AUTH_SECRET`은 운영 환경에서 반드시 `openssl rand -base64 32` 등으로 새로 생성하세요.

### Render로 배포하기

저장소 루트의 `render.yaml`이 웹 서비스(Next.js)와 PostgreSQL 인스턴스를 함께 선언하는 Blueprint입니다.

1. Render 대시보드 → **New** → **Blueprint** → 이 GitHub 저장소 연결 (배포할 브랜치 선택).
2. Render가 `render.yaml`을 읽어 `scm-inventory-db`(Postgres)와 `scm-inventory-dashboard`(웹 서비스)를 함께 생성합니다.
   `DATABASE_URL`은 두 서비스 간에 자동으로 연결되고, `AUTH_SECRET`은 자동 생성됩니다.
3. 웹 서비스 환경변수에서 `NEXTAUTH_URL`을 배포된 실제 URL(예: `https://scm-inventory-dashboard.onrender.com`)로 채워주세요.
4. 첫 배포가 끝나면 Render의 Shell 탭(또는 `DATABASE_URL`을 로컬에 임시로 지정해)에서 초기 데이터를 만듭니다:

   ```bash
   npm run db:init
   npm run db:create-admin -- --email admin@company.com --password <강력한-비밀번호> --name 관리자
   ```

배포 브랜치를 바꾸거나 재배포할 때는 `startCommand`(`prisma migrate deploy`)가 스키마 변경을 자동 적용합니다.

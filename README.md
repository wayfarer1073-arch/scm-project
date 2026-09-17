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

실제 PostgreSQL 통합 테스트와 성능 측정은 별도의 로컬 DB에서 실행합니다. DB 이름은 `_test`로
끝나야 하며, 실행기는 localhost/127.0.0.1/::1 이외의 연결을 거부합니다. `.env`의 운영 URL을
재사용하지 말고 명시적으로 지정하세요. 아래는 PowerShell 예시입니다.

```powershell
$env:DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/scm_inventory_test?schema=public'
npx prisma migrate deploy
npm run test:integration
npm run benchmark:inventory
```

DB는 사전에 생성해야 합니다. 테스트는 임의 식별자로 만든 자체 데이터만 정리합니다.
벤치마크 기본값은 500 SKU, 60일 이력, 5회 반복이며 `BENCH_SKUS`, `BENCH_DAYS`,
`BENCH_REPEATS` 환경변수로 변경할 수 있습니다. 측정값은 DB 저장/조회 함수의 실행 시간이며
Excel 파싱, HTTP 전송, 브라우저 렌더링 시간은 포함하지 않습니다.

같은 테스트 DB를 사용하는 앱을 별도 터미널에서 실행한 뒤 `npm run test:smoke`를 실행하면
로그인·Excel 업로드·입고 보정·재업로드·대시보드·리포트 내보내기를 HTTP로 검증합니다.
기본 주소는 `http://127.0.0.1:3107`이며 `SMOKE_BASE_URL`로 로컬 주소를 변경할 수 있습니다.
앱 실행 예: `npm run build` 후 `npm run start -- -H 127.0.0.1 -p 3107`.
앱의 `NEXTAUTH_URL`도 같은 주소로 지정하고 테스트용 `AUTH_SECRET`을 설정하세요.

## 재고·입고·과거 조회의 의미

- 기준일의 SKU 구성은 그 날짜 이전의 최신 ACTIVE 스냅샷으로 결정합니다. 현재 업로드에서
  사라진 SKU도 당시 스냅샷에 있었다면 과거 조회와 과거 일별 합계에 포함합니다.
- 입고 특이사항은 `(이전 관측일, 현재 관측일]` 사이의 수량을 합산하여 소진을 보정합니다.
  스냅샷 없는 날짜의 입고도 반영하며, 과거 스냅샷을 추가하면 구간을 다시 나눕니다.
  첫 관측일 이전·당일의 입고는 비교할 이전 재고가 없어 소진으로 계산하지 않습니다.
- 이벤트의 수량은 메모입니다. 실제 소진 계산을 바꾸려면 업로드 캘린더의 입고 특이사항에
  등록해야 합니다. 일별 입고 합계는 동시 등록을 직렬화하지만 요청 재전송을 자동으로 식별하지는 않습니다.
- 숨김 설정, 수동 위험 기준, 소비기한은 현재 관리 정책이며 과거 조회에도 적용됩니다.
  과거 조회는 보관된 재고를 현재 정책으로 다시 분석하는 기능으로, 당시 화면의 불변 감사 기록은 아닙니다.
- 소비기한은 SKU별 대표값 1개입니다. Excel에 같은 SKU가 여러 행이면 가장 이른 날짜를
  선택합니다. 로트별 잔량과 폐기 예상 수량은 지원하지 않습니다.
- 조회 기준일까지 실제 스냅샷이 존재하는 창고는 mock을 제외합니다. 그 이전 시점을 조회할 때는
  해당 시점의 mock만 사용할 수 있으며, 한 시계열에 mock과 실제 재고를 섞지 않습니다.

업로드는 창고별 잠금과 하나의 트랜잭션으로 스냅샷 버전·현재 SKU 상태를 갱신하고,
SKU와 재고 항목을 1,000행 단위로 저장합니다. 일별 추이는 PostgreSQL에서 원가 이월과
합계를 계산해 집계 결과만 가져옵니다. SKU 분석은 정확한 정체 기간·원가 이월을 위해 아직
전체 관측 이력을 읽으므로, 대규모 데이터에서는 추가적인 분석용 집계 설계가 필요합니다.

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

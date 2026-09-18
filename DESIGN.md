---
name: StockBoard
description: 3개 창고 재고 스냅샷을 소진 추세·위험·소비기한 관점에서 보여주는 사내 재고관리 대시보드
colors:
  ink: "oklch(0.19 0.018 260)"
  ink-muted: "oklch(0.5 0.02 260)"
  paper: "oklch(1 0 0)"
  border: "oklch(0.9 0.009 255)"
  risk-danger: "oklch(0.55 0.22 25)"
  risk-danger-bg: "oklch(0.96 0.04 25)"
  risk-warning: "oklch(0.65 0.16 70)"
  risk-warning-bg: "oklch(0.96 0.06 80)"
  risk-normal: "oklch(0.55 0.14 150)"
  risk-normal-bg: "oklch(0.96 0.04 150)"
  risk-stagnant: "oklch(0.55 0.01 260)"
typography:
  display:
    fontFamily: "Noto Sans KR, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Noto Sans KR, ui-sans-serif, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.1
  body:
    fontFamily: "Noto Sans KR, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Noto Sans KR, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "20px"
components:
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
  panel-header:
    backgroundColor: "{colors.paper}"
    padding: "14px 20px"
  lead-row:
    backgroundColor: "{colors.paper}"
    padding: "20px"
  lead-row-hover:
    backgroundColor: "oklch(0.96 0.005 260)"
---

# Design System: StockBoard

## Overview

**Creative North Star: "The Executive Briefing"**

StockBoard의 메인 대시보드는 경영진이 매일 훑어보는 재고 브리핑 문서처럼 짜여 있다. 화면을 열면
가장 먼저 "오늘 확인해야 할 것"이 헤드라인 숫자로 오고, 그 아래로 근거가 되는 통계·비교표·차트·상세
표가 차례로 이어진다. 동일 크기 아이콘 카드를 격자로 늘어놓는 전형적인 SaaS 대시보드 패턴을 의도적으로
거부했다 — 카드는 정보의 우선순위를 표현하지 못하기 때문이다. 대신 하나의 패널 안에서 헤어라인
구분선으로 위계를 만들고, 스캔 순서 자체가 곧 레이아웃이 되도록 했다.

색은 거의 전부 중립(잉크/페이퍼)이며, 위험 신호에만 하나의 강한 악센트(붉은 계열)를 예약해 둔다.
이 악센트는 제품의 실제 주제(재고 위험)와 시각 언어를 일치시키는 장치다 — 장식이 아니라 신호다.

**Key Characteristics:**
- 헤드라인 → 근거 → 상세 표 순서의 "브리핑" 정보 구조
- 동일 크기 아이콘 카드 그리드를 쓰지 않는다 — 리스트, 통계 스트립, 비교 표로 대체
- 하나의 패널, 헤어라인 구분선 — 중첩 카드/그림자 대신 플랫한 위계
- 위험 신호 전용의 단일 강한 악센트 컬러(붉은 계열), 그 외에는 중립 잉크만 사용
- 모든 수치는 tabular-nums로 정렬되어 세로로 비교하기 쉽다

## Colors

팔레트는 거의 전부 중립이다 — 의도적으로 "조용한" 배경 위에 위험 신호만 도드라지게 한다.

### Primary
- **위험 레드 (Risk Danger)** (`oklch(0.55 0.22 25)`): 이 시스템의 유일한 강한 악센트. Action
  Center 헤드라인 숫자, KPI의 "위험 SKU" 수치, 재고 위험상태 분포 도넛의 위험 조각, 재고 테이블의
  위험 상태 점에만 쓴다. 그 외의 곳에는 절대 확장하지 않는다.

### Neutral
- **잉크 (Ink)** (`oklch(0.19 0.018 260)`): 본문 텍스트, 헤드라인, 차트 라인(추세는 위험이 아니므로
  중립 잉크를 쓴다).
- **잉크 뮤트 (Ink Muted)** (`oklch(0.5 0.02 260)`): 보조 텍스트, 라벨, 캡션.
- **페이퍼 (Paper)** (`oklch(1 0 0)`): 패널 배경.
- **보더 (Border)** (`oklch(0.9 0.009 255)`): 패널 테두리와 헤어라인 구분선.

### Status (위험 신호 전용, 재해석 금지)
- **주의 (Warning)** (`oklch(0.65 0.16 70)`) · **정상 (Normal)** (`oklch(0.55 0.14 150)`) ·
  **정체 (Stagnant)** (`oklch(0.55 0.01 260)`): 위험/주의/정상/정체의 의미는 앱 전체에서 고정되어
  있다. 이 색들은 재고 상태 신호 전용이며, 다른 용도(장식, 브랜드 강조 등)로 재사용하지 않는다.

### Named Rules
**The One Signal Rule.** 강한 악센트(위험 레드)는 실제 위험을 가리킬 때만 쓴다. 순위·추세·구분 같은
중립적 정보에 색을 입히면 위험 신호의 신뢰도가 떨어진다 — TOP7 소진량 막대나 재고수량/자산 추이
선은 색이 아니라 순서·굵기·위치로 구분한다.

## Typography

**Display/Body Font:** Noto Sans KR (with ui-sans-serif, system-ui, sans-serif fallback) — 하나의
패밀리가 헤드라인부터 표 데이터까지 전부 담당한다. Operate 화면에서 디스플레이/본문 폰트를 분리하는
것은 불필요한 장식이다.

**Character:** 절제되고 밀도 높은 보고서체. 장식적 대비보다 명확한 스케일 단계를 우선한다.

### Hierarchy
- **Headline** (semibold 600, 36px/4xl, tabular-nums): KPI 스트립의 "총 재고자산", Action Center
  헤드라인 카운트.
- **Display** (semibold 600, 28–32px): 페이지 타이틀(예: "재고 운영 현황"). 이 위에 eyebrow/kicker
  라벨을 절대 얹지 않는다 — 제목이 스스로 말하게 한다.
- **Title** (semibold 600, 14–16px): 패널 헤더, 섹션 제목.
- **Body** (regular 400, 14px): 표 본문, 목록 항목.
- **Label** (medium 500, 11px, muted): 통계 라벨, 캡션, 보조 정보. 모든 수치는 `tabular-nums`.

### Named Rules
**The No-Kicker Rule.** 제목 위에 작은 대문자 eyebrow 라벨을 두지 않는다. 이미 결정되어 있던 관행을
이번 리디자인에서 전면 제거했다 — 헤딩이 곧 라벨이다.

## Layout

패널 하나(`rounded-xl border`)가 최상위 컨테이너다. 패널 내부는 헤어라인(`divide-y` /
`divide-x`)으로 위계를 만들고, 패널을 중첩하지 않는다. 페이지 흐름은 고정 순서를 따른다: 마스트헤드
(제목 + 조회 툴바) → Action Center(헤드라인 + 순위 리스트) → KPI 스트립 → 창고별 비교 표 → 차트
2×2 → 전체 재고 표.

반응형은 구조적으로 처리한다: 좁은 화면에서 폭이 넓은 표(창고 비교 표, 재고 표)는 컬럼을 줄이는 대신
가로 스크롤로 전환하고(`overflow-x-auto`), Action Center의 보조 정보는 `sm:` 이상에서만 노출한다.
유동 타이포(clamp 기반 반응형 폰트 크기)는 쓰지 않는다 — 고정 rem 스케일이 밀도 높은 운영 화면에
더 맞다.

## Elevation & Depth

이 시스템은 그림자를 쓰지 않는다. 위계는 전적으로 보더와 헤어라인 구분선, 배경색 대비(hover 시
`bg-muted/40`)로 표현한다. 기존에 있던 `shadow-[...]` 박스 그림자들은 이번 리디자인에서 모두
제거했다 — 보고서 위의 종이는 서로 겹쳐 떠 있지 않는다.

### Named Rules
**The Flat Paper Rule.** 패널은 정지 상태에서 완전히 평평하다. 깊이는 오직 hover/active의 배경색
전환으로만 표현하고, 장식적 그림자를 쓰지 않는다.

## Shapes

라운딩은 `rounded-xl`(패널 최외곽)과 `rounded-md`/`rounded-lg`(버튼, 입력, 내부 컨트롤) 두 단계만
쓴다. 보더는 항상 1px, 색은 `--border` 토큰 하나로 고정한다. 원형은 상태 점(재고 표의 위험/주의/정상
dot)과 랭크 뱃지(TOP7 차트의 값 원)에만 쓴다.

## Components

### Panel (신규 — 이 리디자인의 기본 컨테이너)
- **Shape:** `rounded-xl border border-border`, 그림자 없음.
- **Header:** `border-b`로 구분, 패딩 `px-5 py-3.5`, 제목(`text-base font-semibold`) + 선택적
  보조 설명(`text-xs text-muted-foreground`).
- **내부 구분:** 콘텐츠 블록 사이는 `divide-y`(세로) 또는 `divide-x`(가로, 2열 이상)만 쓰고 중첩
  카드를 만들지 않는다.

### Action Center Lead + List (신규)
- **Lead row:** 가장 심각한 카테고리 하나를 헤드라인으로 — 큰 숫자(`text-4xl tabular-nums`, 위험
  레드) + 제목 + 대표 SKU 목록. 위험이 없으면 조용한 안내 문구로 대체(체크 아이콘, 중립색).
- **List rows:** 나머지 카테고리는 아이콘 + 라벨 + 숫자 + 대표 SKU + 화살표 한 줄. 클릭 시 재고
  표로 필터가 바로 적용된다.
- **State:** `hover:bg-muted/40`, count가 0이면 `opacity-50`.

### KPI Strip (신규, 카드 그리드 대체)
- **좌측:** 헤드라인 지표(총 재고자산) — 가장 큰 숫자.
- **우측:** 보조 지표들을 `divide-x`(데스크톱) / 2열 그리드(모바일)로, 라벨 위 숫자 아래 구조. 위험
  수치는 위험 레드, 그 외는 잉크.
- **아이콘 배지 박스를 쓰지 않는다** — 숫자와 라벨만으로 충분하다.

### Comparison Table (신규, 창고별 카드 그리드 대체)
- 지표 = 행, 창고 = 열. 창고 헤더는 버튼이며 클릭 시 활성 상태(`bg-foreground text-background`)로
  전체 대시보드 필터에 반영된다.
- 좁은 화면에서는 가로 스크롤(`min-width` 고정 + `overflow-x-auto`), 셀 줄바꿈 금지
  (`whitespace-nowrap`).

### Charts (기존 도넛/막대 리디자인 계승, chrome만 정리)
- Card 박스를 버리고 패널 내부 `divide-x`/`divide-y` 그리드의 한 칸으로 존재한다(제목 + 헤어라인
  없이 바로 그래프).
- 도넛: 리더라인 라벨(카테고리별 고정 슬롯), 중앙에 전체 합계 숫자. 이 차트만 상태 토큰 대신 지정
  색을 쓴다 — 정상 `var(--color-foreground)`(막대 차트와 동일한 잉크 톤), 주의 `#EAB308`(노란색),
  위험 `#F52E7F`. 테이블 상태 점·KPI·Action Center는 여전히 `--status-*` 토큰을 쓰므로, 위험/주의의
  의미(빨강 계열=위험이라는 사이트 전역의 색 규칙)와는 이 차트에서만 의도적으로 갈라진다.
- 랭크 막대: 캡슐형 바 + 끝에 원형 값 뱃지. 순위색은 무지개가 아니라 단일 중립 잉크 램프
  (`oklch(L 0.02 260)`, L은 짙은 값→옅은 값)로, 위험 레드는 쓰지 않는다(순위는 위험이 아니다).
- 시계열 라인: 색은 중립 잉크. 위험 레드를 트렌드 라인에 쓰지 않는다(The One Signal Rule).

### Table (기존 유지, 상태 표시만 변경)
- **Status:** shadcn Badge 대신 점(`size-1.5 rounded-full`, 상태색) + 텍스트로 표시 — 보고서의
  각주 표기에 가깝다.
- 그 외 구조(밀도, 정렬, 필터, 페이지네이션)는 유지.

### Shared Card 프리미티브 (설정/로그인 화면)
- `ui/card.tsx`를 Panel 컨벤션에 맞춰 수정: `CardHeader`가 `border-b` + `px-5 py-3.5`를 갖고,
  `CardTitle`은 `text-base font-semibold`, `CardDescription`은 `text-xs text-muted-foreground`,
  `CardContent`는 `p-5`. 결과적으로 `<Card>`를 쓰는 곳은 자동으로 Panel과 동일한 헤더/타이포를
  얻는다. 그림자와 `border-border/70` 반투명 보더는 제거했다(Flat Paper Rule).
- 여러 `<Card>`를 세로로 쌓을 때도 카드 사이는 `space-y-6` 정도의 여백만 두고, 카드 내부에
  중첩 카드를 만들지 않는다(설정 화면의 창고명/위험 기준/SKU 노출/소비기한/사용자 관리 각각이
  독립된 Card 하나).

### 토글/탭 버튼 (날짜 조회, 태그 선택 등)
- 활성 상태는 `bg-foreground text-background`(잉크 반전), 비활성은 `text-muted-foreground`.
  `shadow-sm`을 쓰던 이전 스타일은 전부 제거했다 — 상태 표현은 색 반전만으로 충분하다.

### Dialog (업로드/게시글 작성)
- 모달 자체는 Panel 시스템 밖의 별도 오버레이 패턴으로 유지한다(패널은 정지 상태에서 평평해야
  하지만, 오버레이의 `shadow-md`는 뜬 레이어를 배경과 분리하는 기능적 depth이지 장식이 아니다).
  성공/경고/오류 상태 박스는 상태 색 토큰(`status-normal/warning/danger`)을 그대로 쓴다.

## Do's and Don'ts

### Do:
- **Do** 강한 악센트(위험 레드)를 실제 위험 신호에만 쓴다.
- **Do** 새 섹션은 패널 + 헤어라인 구분선 패턴을 따른다. 카드 그리드로 되돌아가지 않는다.
- **Do** 모든 수치를 `tabular-nums`로 정렬한다.
- **Do** 좁은 화면에서 밀도 높은 표는 가로 스크롤로 처리한다(컬럼을 구겨 줄바꿈시키지 않는다).

### Don't:
- **Don't** 제목 위에 eyebrow/kicker 라벨을 두지 않는다(The No-Kicker Rule).
- **Don't** 동일 크기 아이콘+제목+텍스트 카드를 격자로 늘어놓지 않는다 — 우선순위가 있는 정보는
  헤드라인+리스트 또는 표로 표현한다.
- **Don't** 그림자로 깊이를 표현하지 않는다(The Flat Paper Rule) — 보더와 배경색 전환만 쓴다.
- **Don't** 재고 상태 색(위험/주의/정상/정체)의 의미를 다른 용도로 재사용하지 않는다.

---

**범위 안내.** 메인 대시보드(`/`), 로그인, 업로드, 게시판, 설정(창고명/위험 기준/SKU 노출/소비기한/
사용자 관리) 화면이 이 시스템으로 이전되었다. **SKU 상세 시트**만 아직 이전 카드 기반 스타일을 쓰고
있다 — 대시보드 테이블 행 클릭 시 열리는 보조 화면으로, 이번 작업 범위 밖이었다. 옮길 때 이 문서를
갱신한다.

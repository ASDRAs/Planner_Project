# UI/UX Specification: NEON GENESIS ARCHIVE

이 문서는 'NEON GENESIS ARCHIVE'의 디자인 시스템과 에반게리온 초호기(Eva-01) 테마 구현을 위한 기술적 지침을 담고 있습니다.

## 1. Core Visual Concept
- **Light Mode (LCL Solution):** 앰버/주황색 기반의 따뜻한 배경. 파일 보관 및 싱크로율 최적화 상태를 상징.
- **Dark Mode (Eva-01 Awakening):** 딥 블랙 기반의 차가운 배경. 네온 그린과 보라색 발광 효과가 강조된 고대비 인터페이스.

## 2. Technical Theme Implementation
- **CSS Variables:** 모든 색상은 `src/app/globals.css`에 정의된 변수를 사용해야 합니다.
  - `--bg-main`: 최상위 배경색.
  - `--text-primary`: 본문 텍스트 색상.
  - `--eva-purple`: 초호기 퍼플 (포인트 컬러).
  - `--eva-green`: 네온 그린 (완료/연결 상태).
- **Dark Mode Logic:** Tailwind 4의 `.dark` 클래스 또는 `[data-theme='dark']`를 통해 제어됩니다. 하드코딩된 `bg-white`나 `zinc` 계열 색상을 사용하지 마십시오.

## 3. Known Issues & Fix Guidelines (Based on `dark.png`)

### 🚩 Issue A: 다크모드 배경 미적용 (Background Inheritance Failure)
- **증상:** 다크모드임에도 배경이 라이트모드(LCL 주황색)로 유지됨.
- **원인:** Next.js의 레이아웃 구조에서 `body`나 최상위 `div`에 `bg-[var(--bg-main)]`가 명시되지 않았거나, 중간 컨테이너에 하드코딩된 배경색이 덮어쓰고 있음.
- **해결책:** 최상위 래퍼 요소에 반드시 `bg-[var(--bg-main)]`를 적용하고, `.dark` 변수에 `!important`를 사용하여 테마 전환을 강제해야 함.

### 🚩 Issue B: 사이드 엣지 정렬 불량 (Edge Positioning)
- **증상:** 기술적 눈금(Side Edges)이 화면 양 끝이 아닌 중앙 본문 영역에 겹쳐서 나타남.
- **원인:** `fixed` 포지셔닝이 상위 `relative` 컨테이너 내부에 갇혀 있거나, `z-index` 우선순위가 낮음.
- **해결책:** `eva-edge-container`는 반드시 `body` 직계 자식으로 존재해야 하며, `fixed`, `left-0`, `right-0`를 통해 뷰포트에 고정되어야 함.

### 🚩 Issue C: 로고 밸런스 (Logo Hierarchy)
- **지침:** "ARCHIVE"가 디자인의 주인공입니다. "NEON GENESIS"는 보조 타이틀로 작게 처리합니다.
- **조정:** ARCHIVE의 자간을 좁히고(`tracking-tighter`), 모바일에서는 폰트 크기를 과감하게 줄여 가시성을 확보합니다.

### 🚩 Issue D: 화면 깜빡임 (Flickering/Jitter)
- **원인:** `sticky` 헤더와 `backdrop-filter`가 충돌하거나, `body`에 걸린 `transition: all`이 리렌더링 시마다 모든 속성을 계산하기 때문.
- **해결책:** `body`의 `transition`을 제거하고, 상단바에 `transform: translateZ(0)`를 부여하여 하드웨어 가속 레이어를 생성해야 함.

## 4. Components UI Detail
- **Quest Log:** 각 태스크는 미세한 테두리(`border-[var(--border-subtle)]`)를 가져야 함.
- **FAB (Floating Action Button):** 닫힌 상태에서도 `+` 기호가 보여야 하며, 네온 그린 포인트가 포함된 입체적인 디자인을 유지함.

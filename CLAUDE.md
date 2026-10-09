# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

Windows 바탕화면(배경화면 레이어)에 월간 캘린더를 띄우고, 그 자리에서 바로 일정을 추가·수정·삭제하는 데스크톱 앱. 일정은 Google Calendar와 양방향 동기화된다.

배경, 기존 대안 검토 결과, 배포 계획, Google OAuth 심사 조건은 [PROJECT_BRIEF.md](PROJECT_BRIEF.md)에 정리되어 있다. 범위나 기술 선택이 애매하면 그 문서를 먼저 확인한다.

## 현재 상태

1단계 진행 중. 월간 뷰가 localStorage 저장소에서 일정을 읽어 표시하는 데까지 되어 있고, 날짜 클릭 추가 / 일정 클릭 수정·삭제 UI는 아직 없다. 테스트 프레임워크는 아직 없다.

## 명령어

- `npm run dev`: Vite 개발 서버
- `npm run build`: `tsc -b`로 타입 검사 후 프로덕션 빌드(`dist/`)
- `npm run lint`: oxlint(설정은 `.oxlintrc.json`)
- `npm run preview`: 빌드 결과 미리보기

## 개발 환경

- Node 24(LTS), 패키지 매니저는 npm. 버전은 `.nvmrc`로 고정한다.
- `.npmrc`에 `engine-strict=true`가 있어서 `package.json`의 `engines.node`(`>=24 <25`)와 맞지 않는 Node에서는 `npm install`이 실패한다.
- 스택 버전: Vite 8, React 19, TypeScript 6. `verbatimModuleSyntax`가 켜져 있으므로 타입만 가져올 때는 `import type`을 쓰고, 상대 경로 import에는 `.ts`/`.tsx` 확장자를 붙인다.
- Rust 툴체인은 아직 설치되어 있지 않다(3단계 Tauri에서 필요).

## FullCalendar v7

v6와 패키지 구성이 다르다. 웹에서 찾은 v6 예제를 그대로 쓰지 않는다.

- `@fullcalendar/react` 하나만 설치한다(peer로 `temporal-polyfill` 필요). 플러그인, 로캘, 테마는 모두 하위 경로다: `@fullcalendar/react/daygrid`, `/interaction`, `/locales/ko`, `/themes/classic`. 별도 패키지인 `@fullcalendar/core`, `@fullcalendar/daygrid` 등의 최신 버전은 아직 6.x라서 섞어 설치하면 core가 두 벌 깔린다.
- CSS가 자동 주입되지 않는다. `skeleton.css`와 테마의 `theme.css`, `palette.css`를 직접 import한다.
- 테마도 플러그인이다(`plugins`에 `classicThemePlugin` 포함).
- 헤더 툴바가 기본으로 나오지 않으므로 `headerToolbar`를 지정한다.
- 타입은 `node_modules/@fullcalendar/react/index.d.ts`에서 확인한다.

## 코드 구조

- `src/events/`: 일정 도메인. `CalendarEvent` 타입, `EventStore` 인터페이스, `LocalStorageEventStore` 구현.
- `src/components/MonthCalendar.tsx`: FullCalendar 래퍼. `EventStore`를 prop으로 받고, FullCalendar의 함수형 이벤트 소스(`events={fn}`)로 화면에 보이는 기간만 `store.list(range)`로 요청한다.
- `src/App.tsx`: 사용할 `EventStore` 구현을 고르는 곳. 2단계에서 여기만 바꾼다.

`CalendarEvent`의 날짜는 문자열이다. 종일 일정은 `'YYYY-MM-DD'`, 시간 일정은 ISO 8601이고, `end`는 배타적이다(FullCalendar, Google Calendar와 같은 규칙). `'YYYY-MM-DD'`를 `new Date()`에 그대로 넣으면 UTC 자정으로 해석되므로 로컬 날짜로 변환해서 비교한다(`LocalStorageEventStore`의 `toDate` 참고).

## 개발 단계

1. **웹앱 MVP**: React + TypeScript + Vite + FullCalendar 월간 뷰. 날짜 클릭 → 일정 추가, 일정 클릭 → 수정/삭제. 저장은 localStorage. Lively Wallpaper에 로컬 웹페이지로 등록해 배경화면에서 클릭 동작을 확인한다.
2. **Google Calendar 연동**: 저장소를 localStorage에서 Google Calendar API로 교체.
3. **Tauri 데스크톱 앱**: 창을 WorkerW(바탕화면 아이콘 뒤 레이어)에 고정, 트레이 아이콘, 시작 시 자동 실행.
4. **배포**: GitHub Releases에 설치 파일(.exe) 업로드.

## 단계 순서에서 나오는 설계 제약

- **일정 저장은 처음부터 UI와 분리된 저장소 계층 뒤에 둔다.** 2단계에서 localStorage 구현을 Google Calendar 구현으로 바꿀 때 UI 컴포넌트를 고치지 않아도 되어야 한다. localStorage는 동기 API지만 Google Calendar API는 네트워크 호출이므로, 인터페이스는 처음부터 비동기(Promise)로 만든다.
- **1단계 앱은 순수 웹앱으로 유지한다.** Lively Wallpaper 안에서도 돌아야 하므로 Tauri 전용 API에 의존하지 않는다. 3단계의 Tauri 기능(WorkerW 고정, 트레이, 자동 실행, 자격 증명 저장)은 별도 모듈로 감싼다.
- **서버가 없다.** 모든 로직은 클라이언트(웹뷰 + Tauri 백엔드)에서 동작하고, 일정 데이터는 사용자 구글 계정에만 저장된다.

## Google OAuth

- OAuth 클라이언트 유형은 데스크톱 앱이다. 흐름은 시스템 브라우저에서 로그인/동의 → localhost 루프백 리디렉트로 인증 코드 수신(PKCE) → 토큰 교환 순서다.
- scope는 `https://www.googleapis.com/auth/calendar.events` 하나로 시작한다. scope를 넓히면 공개 배포 때 구글 심사 범위도 커진다.
- refresh token은 Windows 자격 증명 관리자에 저장한다(Tauri keyring 계열 플러그인 등). localStorage나 일반 파일에 두지 않는다.
- OAuth 클라이언트 ID는 개발자가 Google Cloud 콘솔에서 직접 발급한다.

## 저장소

- GitHub: https://github.com/rkdworn/desk-calendar (기본 브랜치 `main`)

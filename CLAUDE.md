# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

Windows 바탕화면(배경화면 레이어)에 월간 캘린더를 띄우고, 그 자리에서 바로 일정을 추가·수정·삭제하는 데스크톱 앱. 일정은 Google Calendar와 양방향 동기화된다.

배경, 기존 대안 검토 결과, 배포 계획, Google OAuth 심사 조건은 [PROJECT_BRIEF.md](PROJECT_BRIEF.md)에 정리되어 있다. 범위나 기술 선택이 애매하면 그 문서를 먼저 확인한다.

## 현재 상태

아직 코드가 없다(문서만 있음). 다음 작업은 1단계 웹앱 MVP 스캐폴딩이다. 빌드·실행·테스트 명령은 스캐폴딩 후 이 파일에 추가한다.

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

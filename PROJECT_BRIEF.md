# 배경화면 캘린더 프로젝트 브리프

> 이 문서는 AI 코딩 에이전트(Antigravity, Claude Code 등)에게 프로젝트 맥락을 전달하기 위한 요약입니다.
> 프로젝트 루트에 두고 "PROJECT_BRIEF.md를 먼저 읽고 시작해줘"라고 요청하세요.

## 목표
Windows 노트북 바탕화면(배경화면 레이어)에 월간 캘린더를 띄우고, 바탕화면에서 바로 클릭해서 일정을 추가/수정/삭제할 수 있는 앱.
일정은 **Google Calendar와 양방향 연동**된다.

## 배경 (기존 대안 검토 결과)
- DesktopCal: 바탕화면에서 수정 가능하지만 구글 캘린더 연동 없음
- Rainmeter 스킨: 구글 캘린더 표시 가능(iCal), 하지만 읽기 전용
- Lively Wallpaper에 구글 캘린더 웹 띄우기: 로그인 문제, UI가 위젯답지 않음
- → "구글 캘린더 연동 + 배경화면에서 직접 수정"을 만족하는 앱이 없어서 직접 개발

## 사용자 / 배포 방식
- 1차: 개발자 본인 개인 사용 (Windows)
- 2차: 지인에게 설치 파일(.exe) 공유 → 반응 좋으면 정식 공개
- 서버 없음. 사용자가 설치해서 쓰는 데스크톱 앱. 일정 데이터는 사용자 구글 계정에만 저장.
- 배포: GitHub Releases (무료). 이후 필요하면 코드 서명 / Microsoft Store.

## 기술 스택 (결정)
- 프론트엔드: React + TypeScript + Vite + FullCalendar
- 데스크톱 래퍼: Tauri (대안: Electron)
- 캘린더 연동: Google Calendar API (REST), OAuth 2.0
- 토큰 저장: Windows 자격 증명 관리자 (Tauri keyring 계열 플러그인 등)

## 개발 단계
1. **웹앱 MVP**: React + FullCalendar 월간 뷰. 날짜 클릭 → 일정 추가, 일정 클릭 → 수정/삭제. 저장은 localStorage.
   - 테스트: Lively Wallpaper(무료, MS Store)에 로컬 웹페이지를 배경화면으로 등록해서 클릭 동작 확인.
2. **Tauri 데스크톱 앱**: 창을 바탕화면 아이콘 뒤 레이어(WorkerW)에 고정, 트레이 아이콘, 시작 시 자동 실행.
3. **Google Calendar 연동**: 저장소를 localStorage → Google Calendar API로 교체.
4. **배포**: GitHub Releases에 설치 파일 업로드.

> 원래는 구글 연동이 Tauri보다 먼저였으나 순서를 바꿨다. 아래 OAuth 흐름(localhost 루프백 수신)은 앱이 로컬 포트를 열어야 해서 순수 웹페이지에서는 불가능하다. 웹용 OAuth로 먼저 붙이면 Tauri 단계에서 로그인을 다시 만들어야 한다.

## Google OAuth 메모
- 흐름: 앱에서 "구글 계정 연결" → 시스템 브라우저로 구글 로그인/동의 → localhost 루프백 리디렉트로 인증 코드 수신(PKCE) → 토큰 교환 → refresh token을 자격 증명 관리자에 저장.
- Google Cloud 콘솔에서 OAuth 클라이언트 ID(유형: 데스크톱 앱) 발급 필요 — 개발자가 직접.
- 권한(scope)은 최소로: `https://www.googleapis.com/auth/calendar.events` 우선 검토.
- **개인 사용은 심사 불필요**:
  - 테스트 모드 + 본인 계정을 테스트 사용자로 등록 → 단, 7일마다 재로그인
  - 또는 심사 없이 "프로덕션" 게시 → 첫 로그인 때 "확인되지 않은 앱" 경고(고급 → 이동), 이후 로그인 유지. 미심사 앱은 사용자 100명 제한.
- 공개 배포 시 구글 심사 필요(캘린더는 '민감' 등급, 유료 보안 감사는 없음): 도메인, 앱 홈페이지, 개인정보처리방침, Search Console 도메인 인증, 시연 영상.

## 알려진 이슈 / 메모
- 서명 안 된 exe는 설치 시 Windows SmartScreen 경고가 뜸 (지인 공유 단계에선 무시 가능).

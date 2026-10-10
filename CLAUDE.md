# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

Windows 바탕화면(배경화면 레이어)에 월간 캘린더를 띄우고, 그 자리에서 바로 일정을 추가·수정·삭제하는 데스크톱 앱. 일정은 Google Calendar와 양방향 동기화된다.

배경, 기존 대안 검토 결과, 배포 계획, Google OAuth 심사 조건은 [PROJECT_BRIEF.md](PROJECT_BRIEF.md)에 정리되어 있다. 범위나 기술 선택이 애매하면 그 문서를 먼저 확인한다.

## 현재 상태

- 1단계(웹앱 MVP) 기능 완료: 월간 뷰, 날짜 클릭으로 추가, 일정 클릭으로 수정·삭제(바깥 클릭/Esc/취소로 닫기), localStorage 저장.
- Tauri 단계 진행 중: 바탕화면 고정, 반투명 판, 이동·크기 조절과 위치 저장, 상단 바만 남기는 접기("숨기기"), 트레이 아이콘(보이기/숨기기, 설정, 종료), 설정 창(투명도·색 4개, 자동 실행 스위치, 구글 계정 연결 자리) 완료(사용자 실기 확인). 자동 실행은 개발 모드에서 꺼 두어서 설치된 앱으로 아직 확인하지 않았다.
- 상단 툴바에는 "오늘" 버튼을 두지 않는다(사용자 요청). 오른쪽은 ‹ › 버튼과 그 위의 작은 숨기기/펼치기 버튼이다.
- 테스트: Rust 쪽은 `layout.rs` 단위 테스트(`cargo test`)가 있다. 웹 쪽은 테스트 프레임워크가 없다.

## 명령어

- `npm run dev`: Vite 개발 서버(포트 5173 고정, `strictPort`)
- `npm run build`: `tsc -b`로 타입 검사 후 프로덕션 빌드(`dist/`). 그 전에 `prebuild`가 `scripts/clean-dist.mjs`로 `dist`를 지운다. **Node 24의 `fs.rmSync(dir, {recursive: true})`가 경로에 한글이 있으면 프로세스째 죽고(0xC0000409), Vite가 기존 출력 폴더를 비울 때 이 함수를 쓰기 때문이다.** 이 프로젝트 안에서 폴더를 통째로 지우는 Node 코드를 쓰지 않는다.
- `npm run lint`: oxlint(설정은 `.oxlintrc.json`)
- `npm run preview`: 빌드 결과 미리보기
- `npm run tauri dev`: Vite 개발 서버를 띄우고 Tauri 앱을 실행한다(PowerShell에서). 첫 Rust 빌드는 5분 정도 걸린다.
- `npm run tauri build`: 릴리스 빌드와 NSIS 설치 파일(`src-tauri/target/release/bundle/nsis/`). 내 계정에만 설치(`installMode: currentUser`, 관리자 권한 불필요), 설치 화면은 한국어.
  - 설치된 앱과 개발 모드는 앱 식별자가 같아서 **동시에 켜면 나중 것이 단일 인스턴스 플러그인 때문에 먼저 것에 넘기고 꺼진다.** 하나를 끄고 다른 것을 켠다.
  - 웹 저장 공간(localStorage: 일정, 색 설정, 접힘 상태)은 출처가 달라 따로다(개발 `http://localhost:5173`, 설치 앱 `http://tauri.localhost`). 창 위치(`layout.json`)는 Rust가 저장해서 공유된다.
- 앱 아이콘 바꾸기: 원본은 루트의 `app-icon.png`(1024×1024). `npm run tauri icon app-icon.png`로 `src-tauri/icons/`를 다시 만들고, 함께 생기는 `android/`, `ios/` 폴더는 지운다(Windows 전용). **아이콘 파일 이름이 그대로면 cargo가 아이콘을 실행 파일에 다시 넣지 않으므로** `src-tauri/`에서 `cargo clean -p desk-calendar --release`(개발 모드는 `--release` 없이) 후 빌드한다. 설치 후 바로가기·작업 표시줄 아이콘이 옛것이면 `ie4uinit.exe -show`로 아이콘 캐시를 새로 고친다.
- `cargo test`(`src-tauri/`에서, PowerShell): Rust 단위 테스트. 하나만 돌리려면 `cargo test <테스트 이름 일부>`

## 개발 환경

- Node 24(LTS), 패키지 매니저는 npm. 버전은 `.nvmrc`로 고정한다.
- `.npmrc`에 `engine-strict=true`가 있어서 `package.json`의 `engines.node`(`>=24 <25`)와 맞지 않는 Node에서는 `npm install`이 실패한다.
- 스택 버전: Vite 8, React 19, TypeScript 6. `verbatimModuleSyntax`가 켜져 있으므로 타입만 가져올 때는 `import type`을 쓰고, 상대 경로 import에는 `.ts`/`.tsx` 확장자를 붙인다.
- Rust는 rustup으로 사용자 폴더에 설치되어 있고, 버전은 `rust-toolchain.toml`로 1.99.0에 고정한다(rustfmt, clippy 포함).
- MSVC 링커와 Windows SDK는 별도 Build Tools 없이 이미 설치된 Visual Studio 2026 Community **Insiders**(`C:\Program Files\Microsoft Visual Studio\18\Insiders`)의 것을 쓴다. 미리보기판이라 `vswhere`로 찾을 때는 `-prerelease`를 붙여야 보인다. VS가 자체 업데이트하는 동안에는 인스턴스 정보가 잠겨 Rust가 링커를 못 찾는다(`link.exe not found`). 업데이트가 끝나면 해결된다.
- **Rust 빌드(cargo, tauri)는 PowerShell에서 실행한다.** Git Bash에는 `/usr/bin/link.exe`(coreutils)가 있어 rustc가 이를 MSVC 링커로 착각하고 `link: extra operand` 에러로 실패한다.

## FullCalendar v7

v6와 패키지 구성이 다르다. 웹에서 찾은 v6 예제를 그대로 쓰지 않는다.

- `@fullcalendar/react` 하나만 설치한다(peer로 `temporal-polyfill` 필요). 플러그인, 로캘, 테마는 모두 하위 경로다: `@fullcalendar/react/daygrid`, `/interaction`, `/locales/ko`, `/themes/classic`. 별도 패키지인 `@fullcalendar/core`, `@fullcalendar/daygrid` 등의 최신 버전은 아직 6.x라서 섞어 설치하면 core가 두 벌 깔린다.
- CSS가 자동 주입되지 않는다. `skeleton.css`와 테마의 `theme.css`, `palette.css`를 직접 import한다.
- 테마도 플러그인이다(`plugins`에 `classicThemePlugin` 포함).
- 헤더 툴바가 기본으로 나오지 않으므로 `headerToolbar`를 지정한다.
- 유틸리티 클래스(`skeleton.css`)가 `display: flex !important` 등 `!important`를 쓴다. 이 속성을 덮어쓰는 우리 CSS에도 `!important`가 필요하다.
- 클래스 이름이 난독화되어 있어 선택자로 쓰지 않는다. `role`(`grid`, `heading`) 같은 속성을 기준으로 잡는다.
- 타입은 `node_modules/@fullcalendar/react/index.d.ts`에서 확인한다.

## 코드 구조

- `src/events/`: 일정 도메인(React 의존 없음).
  - `types.ts`의 `CalendarEvent`, `EventStore.ts`의 저장소 인터페이스, `LocalStorageEventStore.ts` 구현
  - `dates.ts`: 날짜 문자열 파싱·포맷
  - `eventForm.ts`: 저장 형식(`CalendarEvent`) ↔ 편집 폼 값(`EventFormValues`) 변환과 검증
- `src/components/MonthCalendar.tsx`: FullCalendar 래퍼이자 편집 흐름의 주인. 함수형 이벤트 소스(`events={fn}`)로 화면에 보이는 기간만 `store.list(range)`로 요청하고, 날짜/일정 클릭 시 `EventDialog`를 열고, 저장·삭제 후 `refetchEvents()`로 다시 불러온다.
- `src/components/EventDialog.tsx`: 네이티브 `<dialog>` 기반 편집 폼. 저장소를 직접 모르고 콜백(`onSave`/`onDelete`/`onClose`)으로만 통신한다. 콜백이 throw하면 에러 메시지를 다이얼로그에 표시한다.
- `src/App.tsx`: 사용할 `EventStore` 구현을 고르는 곳. 구글 연동 단계에서 여기만 바꾼다.
- `src/platform/tauri.ts`: Tauri 전용 JS API는 여기서만 부른다. `inTauri`가 false인 일반 브라우저(`npm run dev`, E2E)에서도 앱이 그대로 돈다. Tauri에서는 `main.tsx`가 `<html>`에 `desktop` 클래스를 붙여 반투명 스타일(`index.css`)과 창 조작 UI(`WindowHandles.tsx`: 이동 손잡이, 숨기기/펼치기 버튼, 크기 조절 손잡이)를 켠다.
- `settings.html` + `src/settings/`: 트레이 메뉴 "설정"으로 여는 별도 창(Vite 멀티 페이지, `vite.config.ts`의 `build.rolldownOptions.input`). `appearance.ts`가 외관 설정(투명도, 배경·글씨·오늘 칸·일정 블록 색)을 localStorage(`desk-calendar:appearance`)에 저장하고 CSS 변수(`--surface-background`, `--fc-classic-*`)로 적용한다. 두 창은 같은 localStorage를 쓰고, 설정 창이 바꾸면 Tauri 이벤트(`appearance-changed`)로 캘린더 창에 바로 알린다. 자동 실행은 tauri-plugin-autostart이고, 개발 모드(`import.meta.env.DEV`)에서는 스위치를 막는다(개발용 실행 파일이 시작 프로그램에 등록되면 부팅 때 빈 창이 된다). 구글 계정 연결 버튼은 자리만 있다.
- `src/components/useCollapse.ts`: 숨기기(접기). `<html>`에 `collapsed` 클래스를 붙여 날짜 칸을 숨기고 창 높이를 상단 바에 맞춘다. 접힘 여부와 펼칠 때 높이는 localStorage(`desk-calendar:collapsed`, `desk-calendar:expanded-height`)에 둔다. 창 높이를 바꿀 때는 `resizeHeight`를 쓴다(폭을 CSS→물리 픽셀로 다시 계산하면 반올림 때문에 1px씩 변한다).
- `src-tauri/`: Tauri 2 데스크톱 쪽(Rust). 크레이트 이름은 `desk-calendar`(라이브러리 `desk_calendar_lib`), 앱 식별자는 `com.rkdworn.deskcalendar`. 창 설정과 빌드 연결(`devUrl`, `frontendDist`)은 `tauri.conf.json`, 웹뷰에 허용할 권한은 `capabilities/`에 있다. Vite의 포트를 바꾸면 `devUrl`도 같이 바꿔야 한다.
  - `src/lib.rs`: 시작 시 메인 창을 바탕화면에 붙이고(`pin_to_desktop`), 실패하면 일반 창으로 띄운다. 이동·크기 변경 이벤트마다 위치를 저장한다. 트레이 아이콘(`setup_tray`): 왼쪽 클릭은 캘린더 열기/닫기, 우클릭 메뉴는 "캘린더 열기/닫기 · 설정 · 종료". **캘린더 닫기는 창(웹뷰)을 destroy해 메모리를 돌려주고 프로그램과 트레이 아이콘은 남는다**(카카오톡 방식, `RunEvent::ExitRequested`에서 `code: None`이면 `prevent_exit`). 다시 열면 `tauri.conf.json`의 창 설정으로 새로 만들어 `setup_calendar`로 다시 붙인다(Win32 작업은 `run_on_main_thread`로 UI 스레드에서). 프로그램을 끄는 건 트레이 "종료"(`app.exit`)뿐이다. 단일 인스턴스 플러그인이 두 번째 실행을 `open_calendar`로 넘긴다. 설정 창(`open_settings`)은 바탕화면에 붙지 않는 일반 창이고, 이벤트 처리기 안에서 바로 만들면 Windows에서 멈출 수 있어 `async_runtime::spawn`으로 만든다. 창별 권한은 `capabilities/default.json`(main), `capabilities/settings.json`(settings). 창을 보이게 할 때는 반드시 `show_calendar`를 거친다(아래 tao 스타일 문제).
  - `src/desktop.rs`: Win32로 바탕화면 아이콘 레이어에 붙이기(Windows 전용).
  - `src/layout.rs`: 위치 저장·복원(`%APPDATA%\com.rkdworn.deskcalendar\layout.json`)과 기본 위치 계산. 플랫폼 무관, 단위 테스트 있음.

## 바탕화면 고정 (src-tauri/src/desktop.rs)

실기 시험으로 정한 방식이다. 바꾸기 전에 아래 이유를 확인한다.

- **WorkerW(아이콘 뒤)가 아니라 SHELLDLL_DefView(아이콘 레이어)의 자식으로, 아이콘 목록(SysListView32) 위에 붙인다.** WorkerW에 붙이면 보이기는 하지만 아이콘 레이어가 화면 전체의 클릭을 가져가서 캘린더를 클릭할 수 없다(Lively Wallpaper가 입력을 가로채 전달하는 이유). DefView 자식으로 두면 클릭과 키보드 입력이 그대로 되고 Win+D에도 남는다. 대가로 캘린더 영역의 아이콘은 가려진다(사용자 동의함).
- Windows 11 24H2 이후 DefView는 Progman 아래에 있다. 그 전 버전에서 배경화면 슬라이드쇼 등이 WorkerW를 만들면 최상위 WorkerW 아래로 옮겨가므로 둘 다 찾는다.
- **좌표:** 자식 창 좌표는 부모 기준이고, DefView는 모든 모니터를 합친 영역을 덮으며 기준점이 그 왼쪽 위다(이 PC는 (-1920,-1080)). 화면 좌표를 그대로 `SetWindowPos`에 넣으면 다른 모니터로 간다. `ScreenToClient`로 변환한다. 저장 좌표는 화면 기준 물리 픽셀이다.
- **유령 제목 표시줄:** tao는 테두리 없는 창에도 WS_CAPTION 등을 남기고 비클라이언트 영역만 0으로 만든다. 자식 창은 DWM이 처리하지 않아 Windows가 내용 위에 옛날식 제목 표시줄을 덧그린다. 그래서 (1) `attach`가 창을 보이기 전에 서브클래싱(`suppress_frame_painting`)으로 `WM_NCPAINT`/`WM_NCACTIVATE` 그리기를 막고, (2) `show()` 뒤에 `strip_frame`으로 제목 표시줄 스타일을 지운다. 투명 영역에 한 번 그려진 흔적은 다시 칠해지지 않으므로 순서가 중요하다.
- **tao는 창 상태 플래그가 바뀌면(show/hide, 최대화 등) 창 스타일 전체를 다시 써서 WS_CAPTION을 되살린다.** 그런 tao 호출 뒤에는 `strip_frame`을 다시 불러야 한다.
- **WS_THICKFRAME은 남긴다.** Tauri의 가장자리 크기 조절(`TAURI_DRAG_RESIZE_BORDERS`, 창 끝 5px)이 이 스타일이 있을 때만 동작한다. 웹 쪽 바깥 여백(`html.desktop #root` padding 4px)은 이 구역이 판 테두리에 걸치도록 5px보다 좁게 둔다.
- `tauri.conf.json`의 창 설정: `decorations: false`, `transparent: true`, `shadow: false`(켜면 그림자용 비클라이언트 여백이 생긴다), `skipTaskbar: true`, `visible: false`(붙이기 전에 떠 보이지 않게).
- FullCalendar 테마가 그리드를 `--fc-classic-background`(흰색)로 칠하므로, 반투명 모드에서는 이 변수를 투명으로 바꾼다.

### 디버깅

- 화면에 다른 창이 덮여 있으면 `WindowFromPoint`는 그 창(VS Code도 같은 `Chrome_RenderWidgetHostHWND` 클래스)을 돌려준다. 우리 창 판정은 `IsChild`나 `ChildWindowFromPointEx`로 한다.
- 실행 중인 앱의 웹뷰를 조사하려면 `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9333"`을 설정하고 `npm run tauri dev`를 실행한 뒤, playwright의 `chromium.connectOverCDP('http://localhost:9333')`로 붙는다.
- `tauri dev`를 백그라운드로 띄웠다가 멈추면 vite(node)와 `desk-calendar.exe`가 남을 수 있다. 포트 5173과 프로세스를 확인해 정리한다.
- **바탕화면 아이콘이 저절로 옛 배치로 돌아가는 현상은 이 앱과 무관하다.** 앱을 완전히 끈 상태에서도 재현됐다(2026-10-10, 아이콘 위치를 IFolderView로 전후 측정). 주 모니터에서 아이콘이 있는 가장 오른쪽 줄이 비는 순간, 탐색기가 `HKCU\Software\Microsoft\Windows\Shell\Bags\1\Desktop`의 `IconLayouts`에 저장된 다른 화면 구성용 배치를 다시 적용한다(배율이 다른 모니터 3대 환경). F5로는 해결되지 않는다. 사용자는 오른쪽 끝 줄에 아이콘 하나를 항상 두는 방법을 쓰기로 했다.

### 알려진 한계 (아직 처리 안 함)

- explorer.exe가 재시작되면 부모인 DefView가 사라져 캘린더 창도 함께 파괴된다. `TaskbarCreated` 메시지를 받아 다시 붙이는 처리가 필요하다.
- 자식 창은 모니터 배율 변경(WM_DPICHANGED)을 받지 않는다. 배율이 다른 모니터로 옮기면 크기·글자 배율이 맞지 않을 수 있다.
- 우리 UI 스레드는 explorer의 입력 큐와 묶인다. UI 스레드가 멈추면 바탕화면 조작도 멈출 수 있으므로 무거운 작업은 UI 스레드에서 하지 않는다.

### 날짜 규칙

- `CalendarEvent`의 날짜는 문자열이다. 종일 일정은 `'YYYY-MM-DD'`, 시간 일정은 로컬 오프셋이 붙은 ISO 8601(`'2026-10-15T14:00:00+09:00'`)이다. Google Calendar API의 `date`/`dateTime` 필드에 그대로 들어가는 형식이다.
- `end`는 배타적이다(FullCalendar, Google Calendar와 같은 규칙). 하지만 편집 폼에서는 종일 일정의 종료일을 사용자가 보는 마지막 날(포함)로 보여 준다. 이 ±1일 변환은 `eventForm.ts`에서만 한다.
- `'YYYY-MM-DD'`를 `new Date()`에 그대로 넣으면 UTC 자정으로 해석된다. 날짜 문자열은 `dates.ts`의 `parseEventDate`로 파싱한다.

## 개발 단계

1. **웹앱 MVP**: React + TypeScript + Vite + FullCalendar 월간 뷰. 날짜 클릭 → 일정 추가, 일정 클릭 → 수정/삭제. 저장은 localStorage.
2. **Tauri 데스크톱 앱**: 창을 바탕화면 아이콘 레이어에 고정(위 "바탕화면 고정" 참고), 트레이 아이콘, 시작 시 자동 실행.
3. **Google Calendar 연동**: 저장소를 localStorage에서 Google Calendar API로 교체.
4. **배포**: GitHub Releases에 설치 파일(.exe) 업로드.

Tauri가 구글 연동보다 먼저다. OAuth 루프백 흐름은 로컬 포트를 열어야 해서 Tauri 앱에서만 가능하기 때문이다(웹용 OAuth를 임시로 붙이지 않는다).

## 단계 순서에서 나오는 설계 제약

- **일정 저장은 처음부터 UI와 분리된 저장소 계층 뒤에 둔다.** 구글 연동 단계에서 localStorage 구현을 Google Calendar 구현으로 바꿀 때 UI 컴포넌트를 고치지 않아도 되어야 한다. localStorage는 동기 API지만 Google Calendar API는 네트워크 호출이므로, 인터페이스는 처음부터 비동기(Promise)로 만든다.
- **웹 코드는 일반 브라우저에서도 돌게 유지한다.** 개발 서버와 E2E 확인을 브라우저로 하기 때문이다. Tauri 전용 기능은 `src/platform/tauri.ts`를 거치고 `inTauri`로 감싼다. 바탕화면 고정, 트레이, 자동 실행, 자격 증명 저장 같은 OS 기능은 Rust 쪽에 둔다.
- **서버가 없다.** 모든 로직은 클라이언트(웹뷰 + Tauri 백엔드)에서 동작하고, 일정 데이터는 사용자 구글 계정에만 저장된다.

## Google OAuth

- OAuth 클라이언트 유형은 데스크톱 앱이다. 흐름은 시스템 브라우저에서 로그인/동의 → localhost 루프백 리디렉트로 인증 코드 수신(PKCE) → 토큰 교환 순서다.
- scope는 `https://www.googleapis.com/auth/calendar.events` 하나로 시작한다. scope를 넓히면 공개 배포 때 구글 심사 범위도 커진다.
- refresh token은 Windows 자격 증명 관리자에 저장한다(Tauri keyring 계열 플러그인 등). localStorage나 일반 파일에 두지 않는다.
- OAuth 클라이언트 ID는 개발자가 Google Cloud 콘솔에서 직접 발급한다.

## 저장소

- GitHub: https://github.com/rkdworn/desk-calendar (기본 브랜치 `main`)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

Windows 바탕화면(배경화면 레이어)에 월간 캘린더를 띄우고, 그 자리에서 바로 일정을 추가·수정·삭제하는 데스크톱 앱. 일정은 Google Calendar와 양방향 동기화된다.

배경, 기존 대안 검토 결과, 배포 계획, Google OAuth 심사 조건은 [PROJECT_BRIEF.md](PROJECT_BRIEF.md)에 정리되어 있다. 범위나 기술 선택이 애매하면 그 문서를 먼저 확인한다.

## 현재 상태

- 1단계(웹앱 MVP) 완료: 월간 뷰, 날짜 클릭으로 추가, 일정 클릭으로 수정·삭제(바깥 클릭/Esc/취소로 닫기), localStorage 저장.
- 2단계(Tauri) 완료, 사용자 실기 확인: 바탕화면 고정, 반투명 판, 이동·크기 조절과 위치 저장, 상단 바만 남기는 접기("숨기기"), 트레이(캘린더 열기/닫기 · 설정 · 종료, 닫아도 트레이에 남음), 설정 창(투명도·색 4개, 자동 실행 스위치, 구글 계정 연결 버튼 자리), 단일 인스턴스, NSIS 설치 파일, 캘린더 앱 아이콘. 자동 실행 스위치를 설치 앱에서 켜 본 결과는 사용자에게서 명확히 확인받지 못했다.
- **사용자는 설치된 앱을 쓰고 있다**(`%LOCALAPPDATA%\Desk Calendar`, 작업 표시줄 고정, 트레이 아이콘 항상 표시). 코드를 고친 뒤 사용자에게 보여 주려면 `npm run tauri build` → 실행 중인 `desk-calendar.exe` 종료 → 설치 파일을 `/S`로 무인 덮어 설치 → 다시 실행한다. 웹 코드나 아이콘만 바뀐 경우 cargo가 변경을 놓칠 수 있어 `cargo clean -p desk-calendar --release`를 먼저 한다.
- 일정 제목 줄바꿈 표시와 모서리 두 개(왼쪽 위·오른쪽 아래)만으로 하는 크기 조절은 설치 앱에 반영했고, 크기 조절은 사용자가 확인했다.
- 판이 회색·둘레가 검게 보이던 문제(2026-10-12)를 고쳐 설치 앱에 반영했다("바탕화면 고정"의 "배경화면이 비치게 하기"). 캡처로 투명과 이동 후 배경 정렬을 확인했고, 클릭·한글 입력·끌어서 옮기기·크기 조절·숨기기·트레이로 닫았다 열기는 사용자가 확인했다.
- 상단 툴바에는 "오늘" 버튼을 두지 않는다(사용자 요청). 오른쪽은 ‹ › 버튼과 그 위의 작은 숨기기/펼치기 버튼이다.
- 테스트: Rust 쪽은 `layout.rs`, `google.rs` 단위 테스트(`cargo test`)가 있다. 웹 쪽은 테스트 프레임워크가 없고, 지금까지는 `npx vite --port 5199`로 띄운 페이지를 playwright-core(설치된 Chrome 사용, `executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'`)로 조작하는 일회용 스크립트로 확인했다(저장소에는 없다).

## 진행 중: Google Calendar 연동 (3단계)

아래 "Google OAuth" 원칙을 따른다.

- **코드 작성 후 설치 앱에서 사용자 계정 연결까지 했다(2026-10-10).** OAuth 동의 화면은 프로덕션 게시(미심사, 홈페이지는 저장소, 개인정보처리방침은 `PRIVACY.md`, 브랜딩 인증은 github.com 소유 확인이 안 되어 실패했지만 사용에는 지장 없음). 연결 후 자격 증명 관리자에 refresh token이 저장된 것을 확인했다. 사용자가 "구글 캘린더에서 추가한 일정이 안 뜬다"고 했는데 원인은 확인하지 못했다(5분 주기 새로 고침 전이었거나 기본 캘린더가 아닌 곳에 넣었을 가능성). 그 밖에 확인된 것: `cargo test`/clippy, 가짜 `fetch`로 돌린 `GoogleCalendarEventStore` 일회용 테스트(조회·페이지 넘김·추가·PATCH·삭제·401 재시도·410), 브라우저에서 로컬 모드 동작과 불러오기 실패 안내.
- **사용자 쪽 준비:** Google Cloud 콘솔에서 프로젝트 생성 → Calendar API 사용 설정 → Google 인증 플랫폼(앱 이름, 외부, `calendar.events` 범위 추가) → 프로덕션 게시 권장(테스트 모드는 7일마다 재로그인) → 클라이언트(데스크톱 앱) 만들고 JSON 다운로드. 이 JSON을 `src-tauri/google-oauth.json`으로 둔다(아래 "Google OAuth").
- 사용자와 정한 것: 클라이언트 JSON은 저장소에 올리지 않는다. 연결 전 localStorage 일정은 옮기지 않고 그대로 둔다(연결을 끊으면 다시 보인다). 지금은 기본(primary) 캘린더 하나만 쓴다.
- Calendar API는 `http://tauri.localhost` 출처에 CORS를 허용한다(401 응답 포함, curl로 확인).
- 남은 확인: 구글 일정 표시·추가·수정·삭제 왕복, 다시 실행했을 때 로그인 유지, 연결 해제.

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
- `cargo test`(`src-tauri/`에서, PowerShell): Rust 단위 테스트. Claude Code의 셸에서는 cargo가 PATH에 없을 수 있다: `$env:PATH = "$env:USERPROFILE\.cargoin;$env:PATH"`. 하나만 돌리려면 `cargo test <테스트 이름 일부>`

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
  - `colors.ts`: 일정 색. Google Calendar 일정 색 11가지(`colorId` '1'~'11', 구글 화면의 색값, 이름은 영어판 이름)만 쓴다. 구글 일정은 임의의 색을 저장할 수 없어서다. `colorId`가 없는 일정(구글에서 색 없이 만든 일정, 예전 로컬 일정)은 테마 기본색(`--fc-classic-event`, #3788d8)으로 그리고, 이 기본색은 바꿀 수 없다(설정 창의 "기본 일정 색"은 사용자 요청으로 없앴다. 예전에 저장된 `appearance.event` 값은 무시된다). 이 앱에서 만드는 새 일정은 늘 무작위 색으로 시작하고(사용자 요청), 색 선택에는 "기본"이 없다. 구글 쪽 PATCH는 색이 없으면 `colorId: null`을 보낸다.
- `src/components/MonthCalendar.tsx`: FullCalendar 래퍼이자 편집 흐름의 주인. 함수형 이벤트 소스(`events={fn}`)로 화면에 보이는 기간만 `store.list(range)`로 요청하고, 날짜/일정 클릭 시 `EventDialog`를 열고, 저장·삭제 후 `refetchEvents()`로 다시 불러온다.
- `src/components/EventDialog.tsx`: 네이티브 `<dialog>` 기반 편집 폼. 종일 체크 줄 오른쪽 끝에 색 선택(`EventColorPicker.tsx`: 11색, 색 없는 일정은 버튼에 "기본"으로 보인다, 목록이 열려 있을 때 Esc는 목록만 닫는다). 저장소를 직접 모르고 콜백(`onSave`/`onDelete`/`onClose`)으로만 통신한다. 콜백이 throw하면 에러 메시지를 다이얼로그에 표시한다.
- `src/events/GoogleCalendarEventStore.ts`: Google Calendar API(REST, `calendars/primary/events`) 구현. access token은 생성자로 받은 함수(`AccessTokenProvider`)에서 받아 웹뷰의 `fetch`로 직접 부른다. `singleEvents=true`라 반복 일정은 회차별로 오고, 회차를 고치거나 지우면 그 회차만 바뀐다. 요청은 모두 `cache: 'no-store'`라서 WebView2가 일정 응답을 디스크 HTTP 캐시(`%LOCALAPPDATA%\com.rkdworn.deskcalendar\EBWebView\Default\Cache`)에 남기지 않는다(2026-10-10 개인정보 검토, 설치판에서 확인). 수정은 PATCH(설명·장소·알림 등 이 앱이 모르는 필드 보존)이고, 종일↔시간 전환 때 반대쪽 필드를 `null`로 지운다. 401이면 거절된 토큰을 넘겨 새 토큰으로 한 번 재시도한다.
- `src/App.tsx`: 사용할 `EventStore`를 고르는 곳. 구글 연결 중이면 Google, 아니면 localStorage, 연결 여부 확인 전(`useGoogleConnected`가 null)에는 빈 `pendingStore`. 캘린더를 늦게 그리지 않는 이유는 접힌 상태로 시작할 때 `useCollapse`가 빈 화면 높이를 재기 때문이다.
- `src/components/useGoogleConnected.ts`: 연결 여부. Rust의 `google-auth-changed` 이벤트로 바로 바뀌고, 저장소가 바뀌면 `MonthCalendar`가 다시 불러온다.
- `MonthCalendar`는 5분마다와 `online` 이벤트 때 다시 불러오고(다른 기기에서 바꾼 일정 반영), 실패하면 아래쪽에 안내와 "다시 시도"를 띄우고 30초 뒤 재시도한다(FullCalendar는 실패해도 이미 보이던 일정을 남긴다).
- 일정은 종일이든 시간 일정이든 모두 색 막대다(`eventDisplay="block"`, 사용자 요청). FullCalendar 기본값(`auto`)은 하루 안의 시간 일정을 점 + 글씨로 그린다(사용자가 점 모양 + 흰 막대도 써 본 뒤 막대로 정했다). 설정 창의 "일정 투명도"(`eventOpacity`, CSS `--event-opacity`)는 막대 배경색에만 `color-mix`로 섞고 글씨는 그대로 둔다(`index.css`). 색은 `MonthCalendar`의 `toEventInput`이 `color`와 `contrastColor`(v7 이름, v6의 `textColor`가 아니다, 밝은 색이면 어두운 글씨)로 넘긴다.
- 일정 칸 내용은 `MonthCalendar`의 `eventContent`(`renderEventContent`)로 직접 그린다: 시간 일정은 첫 줄에 시간(`AM 9:00`, `dates.ts`의 `toMeridiemTimeString`, 사용자 요청), 다음 줄에 제목. 시간을 보일지는 FullCalendar의 `timeText`로 정한다(여러 날 일정은 첫 칸만). 시간과 제목 사이에는 구분선이 있고(사용자 요청), 시간은 좁은 칸에서도 한 줄(`nowrap`)이다. 제목은 자르지 않고 줄바꿈한다(사용자 요청, `index.css`의 `.event-label`). `dayMaxEvents`("+N개")는 일부러 쓰지 않는다. 줄바꿈된 일정 높이를 FullCalendar가 보수적으로 계산해 칸에 자리가 남아도 일정을 숨겼다. 쓰지 않으면 붐비는 주만 길어지고 다른 주가 줄어든다(사용자 창 CSS 480×720에서 하루 7개까지 확인).
- `src/platform/tauri.ts`: Tauri 전용 JS API는 여기서만 부른다. `inTauri`가 false인 일반 브라우저(`npm run dev`, E2E)에서도 앱이 그대로 돈다. Tauri에서는 `main.tsx`가 `<html>`에 `desktop` 클래스를 붙여 반투명 스타일(`index.css`)과 창 조작 UI(`WindowHandles.tsx`: 이동 손잡이, 숨기기/펼치기 버튼, 왼쪽 위·오른쪽 아래 크기 조절 손잡이)를 켠다.
- `settings.html` + `src/settings/`: 트레이 메뉴 "설정"으로 여는 별도 창(Vite 멀티 페이지, `vite.config.ts`의 `build.rolldownOptions.input`). `appearance.ts`가 외관 설정(판 투명도, 일정 투명도, 배경·글씨·오늘 칸 색)을 localStorage(`desk-calendar:appearance`)에 저장하고 CSS 변수(`--surface-background`, `--fc-classic-*`)로 적용한다. 두 창은 같은 localStorage를 쓰고, 설정 창이 바꾸면 Tauri 이벤트(`appearance-changed`)로 캘린더 창에 바로 알린다. 자동 실행은 tauri-plugin-autostart이고, 개발 모드(`import.meta.env.DEV`)에서는 스위치를 막는다(개발용 실행 파일이 시작 프로그램에 등록되면 부팅 때 빈 창이 된다). 계정 칸(`GoogleAccount`)에서 구글 연결·취소·연결 해제를 한다.
- `src/components/useCollapse.ts`: 숨기기(접기). `<html>`에 `collapsed` 클래스를 붙여 날짜 칸을 숨기고 창 높이를 상단 바에 맞춘다. 접힘 여부와 펼칠 때 높이는 localStorage(`desk-calendar:collapsed`, `desk-calendar:expanded-height`)에 둔다. 창 높이를 바꿀 때는 `resizeHeight`를 쓴다(폭을 CSS→물리 픽셀로 다시 계산하면 반올림 때문에 1px씩 변한다).
- `src-tauri/`: Tauri 2 데스크톱 쪽(Rust). 크레이트 이름은 `desk-calendar`(라이브러리 `desk_calendar_lib`), 앱 식별자는 `com.rkdworn.deskcalendar`. 창 설정과 빌드 연결(`devUrl`, `frontendDist`)은 `tauri.conf.json`, 웹뷰에 허용할 권한은 `capabilities/`에 있다. Vite의 포트를 바꾸면 `devUrl`도 같이 바꿔야 한다.
  - `src/lib.rs`: 시작 시 메인 창을 바탕화면에 붙이고(`pin_to_desktop`), 실패하면 일반 창으로 띄운다. 이동·크기 변경 이벤트마다 위치를 저장한다. 트레이 아이콘(`setup_tray`): 왼쪽 클릭은 캘린더 열기/닫기, 우클릭 메뉴는 "캘린더 열기/닫기 · 설정 · 종료". **캘린더 닫기는 창(웹뷰)을 destroy해 메모리를 돌려주고 프로그램과 트레이 아이콘은 남는다**(카카오톡 방식, `RunEvent::ExitRequested`에서 `code: None`이면 `prevent_exit`). 다시 열면 `tauri.conf.json`의 창 설정으로 새로 만들어 `setup_calendar`로 다시 붙인다(Win32 작업은 `run_on_main_thread`로 UI 스레드에서). 프로그램을 끄는 건 트레이 "종료"(`app.exit`)뿐이다. 단일 인스턴스 플러그인이 두 번째 실행을 `open_calendar`로 넘긴다. 설정 창(`open_settings`)은 바탕화면에 붙지 않는 일반 창이고, 이벤트 처리기 안에서 바로 만들면 Windows에서 멈출 수 있어 `async_runtime::spawn`으로 만든다. 창별 권한은 `capabilities/default.json`(main), `capabilities/settings.json`(settings). 창을 보이게 할 때는 반드시 `show_calendar`를 거친다(아래 tao 스타일 문제).
  - `src/desktop.rs`: Win32로 바탕화면 아이콘 레이어에 붙이기(Windows 전용).
  - `src/google.rs`: 구글 OAuth와 토큰(아래 "Google OAuth"). 명령 `google_status`, `google_sign_in`, `google_cancel_sign_in`, `google_sign_out`, `google_access_token`. 웹 쪽 호출은 `src/platform/tauri.ts`의 `google`.
  - `build.rs`: `google-oauth.json`을 읽어 클라이언트 ID·비밀을 컴파일 시점 환경 변수(`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)로 넣는다. 파일이 없으면 경고만 내고 연결 기능이 꺼진 채 빌드된다(설정 창 버튼 비활성). 앱 매니페스트(`windows-app-manifest.xml`)도 여기서 넣는다(아래 "배경화면이 비치게 하기").
  - `src/layout.rs`: 위치 저장·복원(`%APPDATA%\com.rkdworn.deskcalendar\layout.json`)과 기본 위치 계산. 플랫폼 무관, 단위 테스트 있음.

## 바탕화면 고정 (src-tauri/src/desktop.rs)

실기 시험으로 정한 방식이다. 바꾸기 전에 아래 이유를 확인한다.

- **WorkerW(아이콘 뒤)가 아니라 SHELLDLL_DefView(아이콘 레이어)의 자식으로, 아이콘 목록(SysListView32) 위에 붙인다.** WorkerW에 붙이면 보이기는 하지만 아이콘 레이어가 화면 전체의 클릭을 가져가서 캘린더를 클릭할 수 없다(Lively Wallpaper가 입력을 가로채 전달하는 이유). DefView 자식으로 두면 클릭과 키보드 입력이 그대로 되고 Win+D에도 남는다. 대가로 캘린더 영역의 아이콘은 클릭할 수 없다(사용자 동의함, 반투명 판 너머로 흐리게 비친다).
- Windows 11 24H2 이후 DefView는 Progman 아래에 있다. 그 전 버전에서 배경화면 슬라이드쇼 등이 WorkerW를 만들면 최상위 WorkerW 아래로 옮겨가므로 둘 다 찾는다.
- **좌표:** 자식 창 좌표는 부모 기준이고, DefView는 모든 모니터를 합친 영역을 덮으며 기준점이 그 왼쪽 위다(이 PC는 (-1920,-1080)). 화면 좌표를 그대로 `SetWindowPos`에 넣으면 다른 모니터로 간다. `ScreenToClient`로 변환한다. 저장 좌표는 화면 기준 물리 픽셀이다.
- **유령 제목 표시줄:** tao는 테두리 없는 창에도 WS_CAPTION 등을 남기고 비클라이언트 영역만 0으로 만든다. 자식 창은 DWM이 처리하지 않아 Windows가 내용 위에 옛날식 제목 표시줄을 덧그린다. 그래서 (1) `attach`가 창을 보이기 전에 서브클래싱(`suppress_painting`)으로 `WM_NCPAINT`/`WM_NCACTIVATE` 그리기를 막고, (2) `show()` 뒤에 `strip_frame`으로 제목 표시줄 스타일을 지운다. 투명 영역에 한 번 그려진 흔적은 다시 칠해지지 않으므로 순서가 중요하다.
- **배경화면이 비치게 하기(layered + 바탕 안 그리기, 2026-10-12):** 아이콘 레이어의 자식 창에서는 GDI로 그린 픽셀이 알파와 상관없이 불투명하다. Tauri는 `transparent: true` 창의 바탕을 WM_PAINT마다 softbuffer로 검정(알파 0)으로 채우므로, 그대로 두면 웹뷰가 투명하게 둔 곳 뒤가 검게 보인다(사용자 보고: 판이 회색, 둘레가 검정). 그래서 서브클래스가 붙어 있는 동안 `WM_PAINT`/`WM_ERASEBKGND`를 그리지 않고 처리한다. 또 일반 자식 창은 부모의 그림판을 같이 써서, 그리지 않은 곳에는 창이 덮기 전의 배경화면·아이콘 픽셀이 남는다(창을 옮기면 따라와 어긋나고, 배경화면이 바뀌어도 옛 그림). 그래서 `attach`가 `WS_EX_LAYERED` + `SetLayeredWindowAttributes(알파 255)`로 자기 그림판을 주고(그리지 않은 곳은 투명하게 합성된다), tao가 확장 스타일을 다시 써도 `WM_STYLECHANGING`에서 `WS_EX_LAYERED`를 유지한다. 자식 창의 layered는 Windows 8부터라 매니페스트에 호환 선언이 없으면 조용히 무시된다. 그래서 `build.rs`가 `src-tauri/windows-app-manifest.xml`(tauri-build 기본값 + Windows 10 `supportedOS`)을 넣는다. 매니페스트가 깨지면 실행이 안 되므로 이 파일은 ASCII만 쓴다. 예전에 검정이 안 보였던 이유는 확인하지 못했다(softbuffer가 창이 최상위일 때 받은 DC를 계속 써서 그리기가 화면에 닿지 않았던 것으로 추정, 모니터 3대 → 노트북 화면 하나로 쓰던 날 처음 보고됨).
- **tao는 창 상태 플래그가 바뀌면(show/hide, 최대화 등) 창 스타일 전체를 다시 써서 WS_CAPTION을 되살린다.** 그런 tao 호출 뒤에는 `strip_frame`을 다시 불러야 한다.
- **창 가장자리 크기 조절은 막았다(사용자 요청, `resizable: false`).** 크기는 왼쪽 위·오른쪽 아래 모서리 손잡이로만 바꾼다. Tauri의 테두리 없는 창 가장자리 크기 조절은 창 끝 5px에 `TAURI_DRAG_RESIZE_BORDERS` 자식 창을 깔고 WS_THICKFRAME이 있을 때 경계 판정을 돌려주는 방식인데, `resizable: false`로 만들면 이 창도 스타일도 생기지 않는다(설치 앱에서 확인). OS 크기 조절 루프(`startResizeDragging`)는 WS_THICKFRAME이 없으면 동작하지 않을 것이라 쓰지 않는다.
- 모서리 손잡이(`WindowHandles.tsx`)는 누를 때 `begin_calendar_resize`로 시작 창 영역과 마우스 위치를 받고, 끄는 동안 `resize_calendar`를 계속 부른다(`lib.rs`). Rust가 마우스 위치를 OS에서 읽어 `layout::resize_from_corner`로 계산하고 `desktop::move_to`로 위치와 크기를 한 번에 바꾼다. 웹의 `screenX`를 쓰지 않는 이유는 왼쪽 위를 끌면 창이 함께 움직이는데 웹뷰가 아는 창 위치가 늦게 따라오기 때문이다. 최소 크기는 CSS 480×360.
- `tauri.conf.json`의 창 설정: `decorations: false`, `transparent: true`, `shadow: false`(켜면 그림자용 비클라이언트 여백이 생긴다), `resizable: false`(위 가장자리 크기 조절), `skipTaskbar: true`, `visible: false`(붙이기 전에 떠 보이지 않게).
- **CSP(`tauri.conf.json`의 `app.security.csp`)는 설치판에만 걸린다.** 데스크톱 `tauri dev`는 웹뷰가 Vite 개발 서버를 직접 열어 Tauri가 헤더를 넣지 못하기 때문이다(`devCsp`는 두지 않았다). 허용 범위: 앱 자신(`'self'`), Tauri IPC(`ipc: http://ipc.localhost`), Calendar API(`https://www.googleapis.com`). 웹뷰가 구글 access token을 받을 수 있어서 넣은 방어선이다(2026-10-10 보안 검토). `style-src`는 `'unsafe-inline'`이 필요하고(FullCalendar·React의 style 속성), Tauri가 여기에 해시를 넣으면 `'unsafe-inline'`이 무시되므로 `dangerousDisableAssetCspModification: ["style-src"]`로 막았다. 외부 자원(폰트, CDN, 다른 API)을 추가하면 CSP에도 넣어야 한다. 설치판을 디버깅 포트로 띄워 확인했다: 일정 정상, 다른 호스트로 fetch 차단, 위반 메시지 없음.
- FullCalendar 테마가 그리드를 `--fc-classic-background`(흰색)로 칠하므로, 반투명 모드에서는 이 변수를 투명으로 바꾼다.

### 디버깅

- 화면에 다른 창이 덮여 있으면 `WindowFromPoint`는 그 창(VS Code도 같은 `Chrome_RenderWidgetHostHWND` 클래스)을 돌려준다. 우리 창 판정은 `IsChild`나 `ChildWindowFromPointEx`로 한다.
- 실행 중인 앱의 웹뷰를 조사하려면 `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9333"`을 설정하고 `npm run tauri dev`를 실행한 뒤, playwright의 `chromium.connectOverCDP('http://localhost:9333')`로 붙는다.
- `tauri dev`를 백그라운드로 띄웠다가 멈추면 vite(node)와 `desk-calendar.exe`가 남을 수 있다. 포트 5173과 프로세스를 확인해 정리한다.
- 다른 창이 바탕화면을 덮고 있어도 `PrintWindow(Progman 창, PW_RENDERFULLCONTENT)`로 캘린더를 포함한 바탕화면 합성 결과를 캡처할 수 있다(사용자 스크린샷과 같게 나왔다). PowerShell에서 하려면 `SetProcessDPIAware`를 먼저 불러야 좌표가 물리 픽셀로 맞는다. 투명 처리를 바꿀 때는 아이콘 레이어에 시험용 자식 창을 붙였다가 옮겨 보고 그 자리가 실제 바탕화면과 같은지 비교하면 된다.
- **바탕화면 아이콘이 저절로 옛 배치로 돌아가는 현상은 이 앱과 무관하다.** 앱을 완전히 끈 상태에서도 재현됐다(2026-10-10, 아이콘 위치를 IFolderView로 전후 측정). 주 모니터에서 아이콘이 있는 가장 오른쪽 줄이 비는 순간, 탐색기가 `HKCU\Software\Microsoft\Windows\Shell\Bags\1\Desktop`의 `IconLayouts`에 저장된 다른 화면 구성용 배치를 다시 적용한다(배율이 다른 모니터 3대 환경). F5로는 해결되지 않는다. 사용자는 오른쪽 끝 줄에 아이콘 하나를 항상 두는 방법을 쓰기로 했다.

### 알려진 한계 (아직 처리 안 함)

- explorer.exe가 재시작되면 부모인 DefView가 사라져 캘린더 창도 함께 파괴된다. 프로그램은 트레이에 남으므로 트레이 아이콘으로 다시 열 수는 있다. 자동으로 다시 붙이려면 `TaskbarCreated` 메시지를 받아 `open_calendar`를 부르는 처리가 필요하다.
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
- OAuth 클라이언트 ID는 개발자가 Google Cloud 콘솔에서 직접 발급한다. 콘솔에서 받은 JSON(`{"installed": {...}}`)을 `src-tauri/google-oauth.json`으로 두면 `build.rs`가 실행 파일에 넣는다. 이 파일은 `.gitignore`에 있다(사용자 결정). 지금 콘솔은 클라이언트 비밀을 만들 때 한 번만 보여 준다.
- 구현(`src-tauri/src/google.rs`): `127.0.0.1:0`(임의 포트)에서 받고 시스템 브라우저는 tauri-plugin-opener로 연다. `access_type=offline`과 `prompt=consent`로 매번 refresh token을 받는다. 브라우저가 미리 연결만 해 두는 경우가 있어 루프백 연결마다 따로 처리하고, 응답 전에 요청 머리글 끝까지 읽는다(덜 읽고 닫으면 RST로 브라우저가 응답을 못 볼 수 있다). 로그인 대기는 5분, 새 로그인이나 취소 버튼이 이전 대기를 멈춘다. 동의 화면에서 캘린더 권한 체크를 풀면 실패로 처리한다.
- refresh token은 keyring-core + windows-native-keyring-store로 자격 증명 관리자의 `google-refresh-token.com.rkdworn.deskcalendar` 항목에 둔다. access token은 Rust 메모리에만 두고 웹이 `google_access_token`으로 받는다. 갱신 때 `invalid_grant`(구글 쪽 권한 취소, 테스트 모드 7일 만료)면 저장된 토큰을 지우고 `google-auth-changed(false)`를 보낸다.
- HTTP는 reqwest를 `native-tls`(Windows 내장 TLS)로 쓴다. reqwest 0.13 기본 TLS는 rustls + aws-lc-rs라 Windows에서 CMake·NASM이 필요하다.

## 저장소

- GitHub: https://github.com/rkdworn/desk-calendar (기본 브랜치 `main`)

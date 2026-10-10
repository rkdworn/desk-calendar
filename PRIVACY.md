# Desk Calendar 개인정보처리방침

시행일: 2026년 10월 10일

Desk Calendar(이하 "앱")는 Windows 바탕화면에 월간 캘린더를 띄우고, 사용자의 Google 캘린더 일정을 보여 주고 고칠 수 있게 하는 데스크톱 앱입니다. 이 문서는 앱이 어떤 정보를 어떻게 다루는지 설명합니다.

## 요약

- 앱에는 서버가 없습니다. 일정은 사용자의 PC와 Google 사이에서만 오갑니다.
- 앱 개발자는 사용자의 일정이나 계정 정보를 받거나 저장하지 않습니다.
- 앱은 어떤 정보도 제3자에게 팔거나 넘기지 않으며, 광고나 사용 통계 수집을 하지 않습니다.

## 앱이 접근하는 Google 사용자 데이터

사용자가 앱 설정에서 "구글 계정 연결"을 하면, 앱은 Google 로그인 화면에서 사용자가 허용한 다음 권한을 받습니다.

- `https://www.googleapis.com/auth/calendar.events`: Google 캘린더 일정 보기·추가·수정·삭제

앱은 이 권한으로 다음 일만 합니다.

- 캘린더 화면에 보이는 기간의 일정(제목, 시작·종료 날짜와 시각, 일정 색)을 불러와 바탕화면에 표시
- 사용자가 앱에서 직접 추가·수정·삭제한 일정을 Google 캘린더에 반영

일정을 불러올 때 Google은 설명, 장소, 참석자 같은 다른 항목도 함께 보내지만, 앱은 이를 화면에 쓰거나 저장하지 않습니다. 일정을 수정할 때도 제목, 날짜·시각, 일정 색만 바꾸고 다른 항목은 건드리지 않습니다.

## 정보가 저장되는 곳

- **로그인 정보(refresh token):** 사용자 PC의 Windows 자격 증명 관리자에만 저장됩니다. 다음에 앱을 실행할 때 다시 로그인하지 않도록 하는 데 쓰입니다.
- **일시적인 접근 토큰(access token):** 앱이 실행되는 동안 PC 메모리에만 있고, 앱을 끄면 사라집니다.
- **불러온 일정:** 화면에 보여 주는 데만 쓰고 앱이 따로 파일로 저장하지 않습니다. 다만 앱 화면을 그리는 Windows 구성 요소(WebView2)가 PC의 앱 데이터 폴더에 임시 캐시를 둘 수 있습니다.
- **Google 계정을 연결하지 않고 넣은 일정, 화면 설정(색, 투명도, 창 위치):** 사용자 PC에만 저장됩니다.

## 연결 해제와 데이터 삭제

- 앱 설정에서 "연결 해제"를 누르면 PC에 저장된 로그인 정보를 지우고, Google에 앱의 접근 권한을 취소하도록 요청합니다.
- Google 계정의 [타사 앱 및 서비스 연결](https://myaccount.google.com/connections) 화면에서도 언제든 앱의 접근 권한을 취소할 수 있습니다.
- 앱을 삭제하기 전에 설정에서 "연결 해제"를 누르면 PC에 남는 로그인 정보까지 지워집니다. Google 캘린더의 일정은 사용자의 Google 계정에 그대로 남습니다.

## Google API 서비스 사용자 데이터 정책 준수

Desk Calendar's use and transfer of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

앱이 Google API에서 받은 정보의 사용과 전송은 제한적 사용 요건을 포함한 [Google API 서비스 사용자 데이터 정책](https://developers.google.com/terms/api-services-user-data-policy)을 따릅니다.

## 문의와 변경

이 방침에 대한 문의는 [GitHub 이슈](https://github.com/rkdworn/desk-calendar/issues)로 남겨 주세요. 방침이 바뀌면 이 문서를 고치고 시행일을 새로 적습니다.

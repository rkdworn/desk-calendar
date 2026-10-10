//! 구글 계정 연결(OAuth 2.0, 데스크톱 앱 흐름)과 토큰 관리.
//!
//! 시스템 브라우저에서 로그인·동의 → 127.0.0.1 루프백으로 인증 코드 수신(PKCE) → 토큰 교환.
//! refresh token은 Windows 자격 증명 관리자에만 두고, access token은 메모리에만 둔다.
//! 캘린더 API는 웹 쪽(`GoogleCalendarEventStore.ts`)이 `google_access_token`으로 받은 토큰으로
//! 직접 부른다.

use std::collections::HashMap;
use std::fmt::Display;
use std::net::Ipv4Addr;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio::task::AbortHandle;
use url::Url;

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";
/// 일정 읽기·쓰기만. 넓히면 공개 배포 때 구글 심사 범위도 커진다.
const SCOPE: &str = "https://www.googleapis.com/auth/calendar.events";

/// build.rs가 google-oauth.json에서 넣는다. 파일 없이 빌드하면 None이고 연결 기능이 꺼진다.
const CLIENT_ID: Option<&str> = option_env!("GOOGLE_CLIENT_ID");
const CLIENT_SECRET: Option<&str> = option_env!("GOOGLE_CLIENT_SECRET");

/// 자격 증명 관리자에는 "google-refresh-token.com.rkdworn.deskcalendar"라는 이름으로 보인다
const KEYRING_SERVICE: &str = "com.rkdworn.deskcalendar";
const KEYRING_USER: &str = "google-refresh-token";

/// 브라우저에서 로그인을 마칠 때까지 기다리는 최대 시간
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
/// 루프백 연결이 요청을 보내지 않고 머무를 수 있는 시간(브라우저가 미리 연결만 해 두는 경우 등)
const REQUEST_READ_TIMEOUT: Duration = Duration::from_secs(30);
const HTTP_TIMEOUT: Duration = Duration::from_secs(30);
/// 만료 직전의 access token을 넘기지 않도록 이만큼 남았으면 새로 받는다
const EXPIRY_MARGIN: Duration = Duration::from_secs(60);

/// 연결 상태가 바뀌면 모든 창에 보내는 이벤트. payload는 연결 여부(bool).
const AUTH_CHANGED_EVENT: &str = "google-auth-changed";

/// 웹 쪽으로 넘기는 오류. JS에서는 `{ kind: 'notSignedIn' }`, `{ kind: 'failed', message }` 모양이다.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AuthError {
  /// google-oauth.json 없이 빌드됐다
  NotConfigured,
  /// 연결된 계정이 없거나, 구글 쪽에서 연결이 끊겼다(권한 취소 등)
  NotSignedIn,
  /// 사용자가 로그인을 취소했거나 새 로그인이 시작됐다
  Cancelled,
  Failed(String),
}

/// 사용자에게 보일 설명과 함께 실패를 기록한다
fn failed(context: &str, error: impl Display) -> AuthError {
  log::error!("{context}: {error}");
  AuthError::Failed(format!("{context}: {error}"))
}

pub struct GoogleAuth {
  http: reqwest::Client,
  /// tokio Mutex라서 토큰을 새로 받는 동안 다른 요청은 기다렸다가 같은 토큰을 받는다
  access: tokio::sync::Mutex<Option<AccessToken>>,
  /// 진행 중인 로그인. 새 로그인을 시작하거나 취소하면 멈춘다.
  pending: Mutex<Option<AbortHandle>>,
}

impl GoogleAuth {
  pub fn new() -> Self {
    Self {
      http: reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .expect("failed to build HTTP client"),
      access: tokio::sync::Mutex::new(None),
      pending: Mutex::new(None),
    }
  }
}

struct AccessToken {
  value: String,
  expires_at: Instant,
}

impl AccessToken {
  fn new(value: String, expires_in: u64) -> Self {
    Self { value, expires_at: Instant::now() + Duration::from_secs(expires_in) }
  }

  fn usable(&self) -> bool {
    Instant::now() + EXPIRY_MARGIN < self.expires_at
  }
}

struct Client {
  id: &'static str,
  secret: &'static str,
}

fn client() -> Result<Client, AuthError> {
  match (CLIENT_ID, CLIENT_SECRET) {
    (Some(id), Some(secret)) => Ok(Client { id, secret }),
    _ => Err(AuthError::NotConfigured),
  }
}

#[derive(Serialize)]
pub struct GoogleStatus {
  /// 이 빌드에 OAuth 클라이언트가 들어 있는지
  configured: bool,
  connected: bool,
}

#[tauri::command]
pub async fn google_status() -> Result<GoogleStatus, AuthError> {
  Ok(GoogleStatus { configured: client().is_ok(), connected: load_refresh_token()?.is_some() })
}

/// 브라우저로 구글 로그인을 받아 계정을 연결한다. 로그인이 끝나거나 실패·취소될 때까지 기다린다.
#[tauri::command]
pub async fn google_sign_in(app: AppHandle, auth: State<'_, GoogleAuth>) -> Result<(), AuthError> {
  let client = client()?;
  let task = tokio::spawn(authorize(app.clone(), auth.http.clone(), client));
  let id = task.id();
  // 이전 로그인이 기다리는 중이면(브라우저 탭을 그냥 닫은 경우 등) 그만두게 한다
  if let Some(previous) = auth.pending.lock().unwrap().replace(task.abort_handle()) {
    previous.abort();
  }
  let result = task.await;
  {
    let mut pending = auth.pending.lock().unwrap();
    if pending.as_ref().is_some_and(|task| task.id() == id) {
      *pending = None;
    }
  }
  let tokens = match result {
    Ok(tokens) => tokens?,
    Err(e) if e.is_cancelled() => return Err(AuthError::Cancelled),
    Err(e) => return Err(failed("로그인 중 오류가 났습니다", e)),
  };

  // 동의 화면에서 캘린더 권한 체크를 풀면 토큰은 나오지만 캘린더 API를 쓸 수 없다
  if !tokens.scope.split(' ').any(|s| s == SCOPE) {
    revoke_in_background(&auth.http, tokens.access_token);
    return Err(AuthError::Failed(
      "캘린더 접근 권한이 허용되지 않았습니다. 다시 연결하면서 캘린더 권한에 체크해 주세요.".into(),
    ));
  }
  let Some(refresh_token) = tokens.refresh_token else {
    return Err(failed("구글이 refresh token을 보내지 않았습니다", "no refresh_token in response"));
  };
  save_refresh_token(&refresh_token)?;
  *auth.access.lock().await = Some(AccessToken::new(tokens.access_token, tokens.expires_in));
  log::info!("google account connected");
  notify(&app, true);
  Ok(())
}

#[tauri::command]
pub fn google_cancel_sign_in(auth: State<'_, GoogleAuth>) {
  if let Some(task) = auth.pending.lock().unwrap().take() {
    task.abort();
  }
}

/// 연결을 끊는다. 이 PC의 토큰을 지우고 구글 쪽 권한도 거둔다.
#[tauri::command]
pub async fn google_sign_out(app: AppHandle, auth: State<'_, GoogleAuth>) -> Result<(), AuthError> {
  let refresh_token = load_refresh_token()?;
  delete_refresh_token()?;
  *auth.access.lock().await = None;
  log::info!("google account disconnected");
  notify(&app, false);
  if let Some(token) = refresh_token {
    revoke_in_background(&auth.http, token);
  }
  Ok(())
}

/// 캘린더 API에 쓸 access token. 만료됐으면 저장된 refresh token으로 새로 받는다.
/// `rejected`는 API가 401로 거절한 토큰이다. 지금 가진 토큰과 같으면 만료 전이라도 새로 받는다.
#[tauri::command]
pub async fn google_access_token(
  app: AppHandle,
  auth: State<'_, GoogleAuth>,
  rejected: Option<String>,
) -> Result<String, AuthError> {
  let mut access = auth.access.lock().await;
  if let Some(token) = access.as_ref()
    && token.usable()
    && rejected.as_deref() != Some(token.value.as_str())
  {
    return Ok(token.value.clone());
  }
  *access = None;

  let client = client()?;
  let refresh_token = load_refresh_token()?.ok_or(AuthError::NotSignedIn)?;
  let form = [
    ("grant_type", "refresh_token"),
    ("refresh_token", refresh_token.as_str()),
    ("client_id", client.id),
    ("client_secret", client.secret),
  ];
  match request_token(&auth.http, &form).await {
    Ok(tokens) => {
      let value = tokens.access_token.clone();
      *access = Some(AccessToken::new(tokens.access_token, tokens.expires_in));
      Ok(value)
    }
    Err(TokenFailure::InvalidGrant) => {
      // 구글 쪽에서 연결이 끊겼다(구글 계정 설정에서 권한 취소, 테스트 모드의 7일 만료 등)
      log::warn!("refresh token rejected; disconnecting");
      delete_refresh_token()?;
      notify(&app, false);
      Err(AuthError::NotSignedIn)
    }
    Err(TokenFailure::Other(e)) => Err(e),
  }
}

fn notify(app: &AppHandle, connected: bool) {
  if let Err(e) = app.emit(AUTH_CHANGED_EVENT, connected) {
    log::error!("failed to emit {AUTH_CHANGED_EVENT}: {e}");
  }
}

/// 토큰 폐기는 실패해도(오프라인 등) 이 PC에서는 이미 지웠으므로 기다리지 않는다
fn revoke_in_background(http: &reqwest::Client, token: String) {
  let request = http.post(REVOKE_URL).form(&[("token", token)]);
  tokio::spawn(async move {
    if let Err(e) = request.send().await.and_then(|r| r.error_for_status()) {
      log::warn!("failed to revoke google token: {e}");
    }
  });
}

// ---- 브라우저 로그인 ----

/// 브라우저 로그인부터 토큰 교환까지. 취소할 수 있게 별도 작업으로 돈다.
async fn authorize(app: AppHandle, http: reqwest::Client, client: Client) -> Result<TokenResponse, AuthError> {
  let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
    .await
    .map_err(|e| failed("로그인 응답을 받을 포트를 열지 못했습니다", e))?;
  let port = listener.local_addr().map_err(|e| failed("로그인 응답을 받을 포트를 열지 못했습니다", e))?.port();
  let redirect_uri = format!("http://127.0.0.1:{port}");
  let verifier = random_token();
  let state = random_token();

  let url = authorization_url(client.id, &redirect_uri, &pkce_challenge(&verifier), &state);
  app.opener().open_url(url.as_str(), None::<&str>).map_err(|e| failed("브라우저를 열지 못했습니다", e))?;

  let code = tokio::time::timeout(SIGN_IN_TIMEOUT, receive_code(listener, state))
    .await
    .map_err(|_| AuthError::Failed("로그인을 기다리는 시간이 지났습니다. 다시 시도해 주세요.".into()))??;

  let form = [
    ("grant_type", "authorization_code"),
    ("code", code.as_str()),
    ("redirect_uri", redirect_uri.as_str()),
    ("code_verifier", verifier.as_str()),
    ("client_id", client.id),
    ("client_secret", client.secret),
  ];
  request_token(&http, &form).await.map_err(|e| match e {
    TokenFailure::InvalidGrant => AuthError::Failed("구글이 인증 코드를 거절했습니다. 다시 시도해 주세요.".into()),
    TokenFailure::Other(e) => e,
  })
}

fn authorization_url(client_id: &str, redirect_uri: &str, challenge: &str, state: &str) -> Url {
  Url::parse_with_params(
    AUTH_URL,
    [
      ("client_id", client_id),
      ("redirect_uri", redirect_uri),
      ("response_type", "code"),
      ("scope", SCOPE),
      ("code_challenge", challenge),
      ("code_challenge_method", "S256"),
      ("state", state),
      // refresh token을 받아 다음 실행부터는 로그인 없이 쓴다. prompt=consent가 없으면 구글은
      // 전에 동의한 계정에 refresh token을 다시 주지 않는다.
      ("access_type", "offline"),
      ("prompt", "consent"),
    ],
  )
  .expect("AUTH_URL is a valid URL")
}

/// 추측할 수 없는 43자 문자열(32바이트 난수의 base64url). PKCE code_verifier와 state에 쓴다.
fn random_token() -> String {
  let mut bytes = [0u8; 32];
  getrandom::fill(&mut bytes).expect("OS random number generator failed");
  URL_SAFE_NO_PAD.encode(bytes)
}

fn pkce_challenge(verifier: &str) -> String {
  URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

/// 작업이 끝나거나 취소되면(drop) 딸린 작업도 멈춘다
struct AbortOnDrop(AbortHandle);

impl Drop for AbortOnDrop {
  fn drop(&mut self) {
    self.0.abort();
  }
}

/// 브라우저가 리디렉트해 오는 요청을 기다려 인증 코드를 꺼낸다. 브라우저는 미리 연결만 해 두거나
/// favicon을 따로 요청하기도 해서, 한 연결에 묶여 기다리지 않도록 연결마다 따로 처리한다.
async fn receive_code(listener: TcpListener, state: String) -> Result<String, AuthError> {
  let (tx, mut rx) = mpsc::channel(1);
  let acceptor = tokio::spawn(async move {
    while let Ok((stream, _)) = listener.accept().await {
      tokio::spawn(handle_redirect(stream, state.clone(), tx.clone()));
    }
  });
  // 여기서 돌아가거나 로그인이 취소되면 포트를 닫는다
  let _acceptor = AbortOnDrop(acceptor.abort_handle());
  rx.recv().await.unwrap_or_else(|| Err(failed("로그인 응답을 받지 못했습니다", "loopback listener stopped")))
}

async fn handle_redirect(mut stream: TcpStream, state: String, tx: mpsc::Sender<Result<String, AuthError>>) {
  let Ok(Some(target)) = tokio::time::timeout(REQUEST_READ_TIMEOUT, read_request_target(&mut stream)).await else {
    return;
  };
  let (status, body, result) = match parse_redirect(&target, &state) {
    Redirect::Code(code) => (
      "200 OK",
      page("구글 계정 연결 정보를 받았습니다. 이 탭을 닫고 Desk Calendar로 돌아가세요."),
      Some(Ok(code)),
    ),
    Redirect::Denied(error) => (
      "200 OK",
      page("구글 계정 연결을 취소했습니다. 이 탭을 닫아도 됩니다."),
      Some(Err(if error == "access_denied" {
        AuthError::Cancelled
      } else {
        failed("구글이 로그인을 거절했습니다", error)
      })),
    ),
    Redirect::Ignore => ("404 Not Found", String::new(), None),
  };
  let response = format!(
    "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
    body.len()
  );
  if let Err(e) = async {
    stream.write_all(response.as_bytes()).await?;
    stream.shutdown().await
  }
  .await
  {
    log::warn!("failed to answer loopback request: {e}");
  }
  if let Some(result) = result {
    let _ = tx.send(result).await;
  }
}

fn page(message: &str) -> String {
  format!(
    "<!doctype html><meta charset=utf-8><title>Desk Calendar</title>\
     <body style=\"font-family:system-ui,'Malgun Gothic',sans-serif;display:grid;place-items:center;height:90vh\">\
     <p style=\"font-size:18px\">{message}</p>"
  )
}

/// HTTP 요청의 머리글 끝까지 읽고 요청 대상(`/?code=...`)을 돌려준다. GET이 아니면 None.
/// 머리글을 다 읽지 않고 닫으면 Windows가 연결을 강제로 끊어(RST) 브라우저가 응답을 못 볼 수 있다.
async fn read_request_target(stream: &mut TcpStream) -> Option<String> {
  const MAX_HEADER: usize = 16 * 1024;
  let mut buf = Vec::new();
  let mut chunk = [0u8; 2048];
  while !buf.windows(4).any(|w| w == b"\r\n\r\n") {
    if buf.len() > MAX_HEADER {
      return None;
    }
    let n = stream.read(&mut chunk).await.ok()?;
    if n == 0 {
      return None;
    }
    buf.extend_from_slice(&chunk[..n]);
  }
  let line_end = buf.windows(2).position(|w| w == b"\r\n")?;
  let line = std::str::from_utf8(&buf[..line_end]).ok()?;
  let mut parts = line.split(' ');
  match (parts.next(), parts.next()) {
    (Some("GET"), Some(target)) => Some(target.to_string()),
    _ => None,
  }
}

#[derive(Debug, PartialEq)]
enum Redirect {
  Code(String),
  /// 사용자가 동의 화면에서 취소했거나(access_denied) 구글이 거절했다
  Denied(String),
  /// 다른 요청(favicon 등)이거나 state가 맞지 않는다
  Ignore,
}

fn parse_redirect(target: &str, state: &str) -> Redirect {
  let Ok(url) = Url::parse("http://127.0.0.1/").and_then(|base| base.join(target)) else {
    return Redirect::Ignore;
  };
  let params: HashMap<_, _> = url.query_pairs().collect();
  if params.get("state").map(AsRef::as_ref) != Some(state) {
    return Redirect::Ignore;
  }
  if let Some(code) = params.get("code") {
    return Redirect::Code(code.to_string());
  }
  if let Some(error) = params.get("error") {
    return Redirect::Denied(error.to_string());
  }
  Redirect::Ignore
}

// ---- 토큰 요청 ----

#[derive(Deserialize)]
struct TokenResponse {
  access_token: String,
  expires_in: u64,
  /// 인증 코드를 교환할 때만 온다
  refresh_token: Option<String>,
  /// 실제로 허용된 권한(공백으로 구분)
  #[serde(default)]
  scope: String,
}

#[derive(Deserialize)]
struct TokenErrorResponse {
  error: String,
}

enum TokenFailure {
  /// 구글이 grant를 거절했다: refresh token이 취소·만료됐거나 인증 코드가 잘못됐다
  InvalidGrant,
  Other(AuthError),
}

async fn request_token(http: &reqwest::Client, form: &[(&str, &str)]) -> Result<TokenResponse, TokenFailure> {
  let response = http
    .post(TOKEN_URL)
    .form(form)
    .send()
    .await
    .map_err(|e| TokenFailure::Other(failed("구글 서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요", e)))?;
  let status = response.status();
  if status.is_success() {
    return response
      .json()
      .await
      .map_err(|e| TokenFailure::Other(failed("구글 응답을 읽지 못했습니다", e)));
  }
  let body = response.text().await.unwrap_or_default();
  match serde_json::from_str::<TokenErrorResponse>(&body) {
    Ok(e) if e.error == "invalid_grant" => Err(TokenFailure::InvalidGrant),
    _ => Err(TokenFailure::Other(failed("구글이 토큰 요청을 거절했습니다", format!("{status} {body}")))),
  }
}

// ---- refresh token 저장(Windows 자격 증명 관리자) ----

fn refresh_token_entry() -> Result<keyring_core::Entry, AuthError> {
  keyring_core::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| failed("자격 증명 관리자를 열지 못했습니다", e))
}

fn load_refresh_token() -> Result<Option<String>, AuthError> {
  match refresh_token_entry()?.get_password() {
    Ok(token) => Ok(Some(token)),
    Err(keyring_core::Error::NoEntry) => Ok(None),
    Err(e) => Err(failed("저장된 구글 로그인 정보를 읽지 못했습니다", e)),
  }
}

fn save_refresh_token(token: &str) -> Result<(), AuthError> {
  refresh_token_entry()?
    .set_password(token)
    .map_err(|e| failed("구글 로그인 정보를 저장하지 못했습니다", e))
}

fn delete_refresh_token() -> Result<(), AuthError> {
  match refresh_token_entry()?.delete_credential() {
    Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
    Err(e) => Err(failed("구글 로그인 정보를 지우지 못했습니다", e)),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn pkce_challenge_matches_rfc7636_example() {
    // RFC 7636 부록 B
    assert_eq!(
      pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
  }

  #[test]
  fn random_token_is_a_valid_pkce_verifier() {
    let token = random_token();
    // RFC 7636: 43~128자, 영문·숫자와 - . _ ~
    assert_eq!(token.len(), 43);
    assert!(token.chars().all(|c| c.is_ascii_alphanumeric() || "-._~".contains(c)));
    assert_ne!(token, random_token());
  }

  #[test]
  fn redirect_with_code_and_matching_state() {
    assert_eq!(
      parse_redirect("/?state=abc&code=4%2F0Adeu5B&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events", "abc"),
      Redirect::Code("4/0Adeu5B".into())
    );
  }

  #[test]
  fn redirect_with_error() {
    assert_eq!(parse_redirect("/?error=access_denied&state=abc", "abc"), Redirect::Denied("access_denied".into()));
  }

  #[test]
  fn redirect_with_wrong_state_is_ignored() {
    assert_eq!(parse_redirect("/?state=xyz&code=c", "abc"), Redirect::Ignore);
    assert_eq!(parse_redirect("/?code=c", "abc"), Redirect::Ignore);
  }

  #[test]
  fn other_requests_are_ignored() {
    assert_eq!(parse_redirect("/favicon.ico", "abc"), Redirect::Ignore);
    assert_eq!(parse_redirect("/?state=abc", "abc"), Redirect::Ignore);
  }

  #[test]
  fn authorization_url_has_pkce_and_offline_access() {
    let url = authorization_url("id.apps.googleusercontent.com", "http://127.0.0.1:5000", "challenge", "st");
    let params: HashMap<_, _> = url.query_pairs().into_owned().collect();
    assert_eq!(params["redirect_uri"], "http://127.0.0.1:5000");
    assert_eq!(params["scope"], SCOPE);
    assert_eq!(params["code_challenge_method"], "S256");
    assert_eq!(params["access_type"], "offline");
    assert_eq!(params["state"], "st");
  }
}

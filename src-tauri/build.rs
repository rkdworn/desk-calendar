fn main() {
  google_client();
  // tauri-build 기본 매니페스트(Common Controls v6)에 Windows 10 호환 선언을 더했다. 이 선언이 없으면
  // Windows가 이 앱을 Windows 8 이전용으로 보고, 바탕화면에 붙인 캘린더 창(자식 창)에
  // WS_EX_LAYERED를 붙여도 조용히 무시한다(desktop.rs의 attach). 매니페스트가 깨지면 실행 자체가
  // 안 되므로 파일에는 ASCII만 쓴다.
  let windows = tauri_build::WindowsAttributes::new().app_manifest(include_str!("windows-app-manifest.xml"));
  if let Err(error) = tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows)) {
    println!("{error:#}");
    std::process::exit(1);
  }
}

/// Google Cloud 콘솔에서 받은 OAuth 클라이언트(유형: 데스크톱 앱) JSON을 실행 파일에 넣는다.
/// 저장소에 올리지 않는 파일이라(.gitignore), 없으면 구글 연결 기능만 꺼진 채로 빌드된다.
fn google_client() {
  const FILE: &str = "google-oauth.json";
  println!("cargo:rerun-if-changed={FILE}");
  let Ok(text) = std::fs::read_to_string(FILE) else {
    println!("cargo:warning={FILE} not found; Google sign-in is disabled in this build");
    return;
  };
  let json: serde_json::Value =
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("{FILE} is not valid JSON: {e}"));
  // 데스크톱 앱 클라이언트의 JSON은 "installed" 아래에 값이 있다
  let client = &json["installed"];
  for (key, var) in [("client_id", "GOOGLE_CLIENT_ID"), ("client_secret", "GOOGLE_CLIENT_SECRET")] {
    let value = client[key]
      .as_str()
      .unwrap_or_else(|| panic!("{FILE}: installed.{key} missing (is the client type 'Desktop app'?)"));
    println!("cargo:rustc-env={var}={value}");
  }
}

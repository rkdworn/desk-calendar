mod layout;

#[cfg(windows)]
mod desktop;

use tauri::{AppHandle, Manager, RunEvent, WebviewWindow};

const CALENDAR: &str = "main";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    // 이미 실행 중일 때 바로가기(작업 표시줄·시작 메뉴)를 다시 누르면 새로 띄우지 않고 기존
    // 프로그램이 캘린더를 연다. 다른 플러그인보다 먼저 등록해야 한다.
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| open_calendar(app)))
    // Windows 시작 시 자동 실행(HKCU Run). 켜고 끄기는 설정 창에서 한다.
    .plugin(tauri_plugin_autostart::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let window = app.get_webview_window(CALENDAR).ok_or("calendar window not found")?;
      setup_calendar(app.handle(), &window);
      setup_tray(app)?;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|_app, event| {
    // 캘린더를 닫아 창이 하나도 없어도 프로그램은 트레이에 남는다(카카오톡처럼).
    // 사용자 동작으로 생긴 종료 요청은 code가 None이고, 트레이 "종료"(app.exit)는 Some이다.
    if let RunEvent::ExitRequested { code: None, api, .. } = event {
      api.prevent_exit();
    }
  });
}

/// 트레이 아이콘. 왼쪽 클릭은 캘린더 열기/닫기, 오른쪽 클릭 메뉴에는 설정과 종료가 있다.
/// 캘린더를 닫아도 프로그램과 아이콘은 남고, 종료해야 아이콘도 사라진다.
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
  use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
  use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

  let toggle = MenuItem::with_id(app, "toggle", "캘린더 열기/닫기", true, None::<&str>)?;
  let settings = MenuItem::with_id(app, "settings", "설정", true, None::<&str>)?;
  let separator = PredefinedMenuItem::separator(app)?;
  let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&toggle, &settings, &separator, &quit])?;
  let icon = app.default_window_icon().cloned().ok_or(tauri::Error::InvalidIcon(
    std::io::Error::other("no default window icon"),
  ))?;

  TrayIconBuilder::new()
    .icon(icon)
    .tooltip("Desk Calendar")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id().as_ref() {
      "toggle" => toggle_calendar(app),
      "settings" => open_settings(app),
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        toggle_calendar(tray.app_handle());
      }
    })
    .build(app)?;
  Ok(())
}

/// 설정 창을 연다. 바탕화면에 붙지 않는 일반 창이고, 이미 열려 있으면 앞으로 가져온다.
fn open_settings(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("settings") {
    let _ = window.unminimize();
    let _ = window.set_focus();
    return;
  }
  // 이벤트 처리기 안에서 창을 바로 만들면 Windows에서 멈출 수 있어(WebView2 문제) 다른 작업으로 넘긴다
  let app = app.clone();
  tauri::async_runtime::spawn(async move {
    let result = tauri::WebviewWindowBuilder::new(
      &app,
      "settings",
      tauri::WebviewUrl::App("settings.html".into()),
    )
    .title("Desk Calendar 설정")
    .inner_size(480.0, 600.0)
    .center()
    .build();
    if let Err(e) = result {
      log::error!("failed to open settings window: {e}");
    }
  });
}

fn toggle_calendar(app: &AppHandle) {
  match app.get_webview_window(CALENDAR) {
    Some(window) if window.is_visible().unwrap_or(false) => close_calendar(&window),
    _ => open_calendar(app),
  }
}

/// 캘린더 창을 없앤다(숨기는 게 아니라 웹뷰까지 닫아 메모리를 돌려준다). 프로그램은 남는다.
fn close_calendar(window: &WebviewWindow) {
  if let Err(e) = window.destroy() {
    log::error!("failed to close calendar: {e}");
  }
}

/// 캘린더를 연다. 창이 남아 있으면 보이게 하고, 닫혀 있으면 tauri.conf.json의 창 설정으로 새로 만든다.
fn open_calendar(app: &AppHandle) {
  if let Some(window) = app.get_webview_window(CALENDAR) {
    if let Err(e) = show_calendar(&window) {
      log::error!("failed to show calendar: {e}");
    }
    return;
  }
  // 이벤트 처리기 안에서 창을 바로 만들면 Windows에서 멈출 수 있어 다른 작업으로 넘긴다
  let app = app.clone();
  tauri::async_runtime::spawn(async move {
    let Some(config) = app.config().app.windows.iter().find(|w| w.label == CALENDAR).cloned() else {
      log::error!("calendar window config not found");
      return;
    };
    let window = match tauri::WebviewWindowBuilder::from_config(&app, &config).and_then(|b| b.build()) {
      Ok(window) => window,
      Err(e) => {
        log::error!("failed to create calendar window: {e}");
        return;
      }
    };
    // 바탕화면에 붙이는 작업(서브클래싱 등)은 창을 만든 UI 스레드에서 해야 한다
    let handle = app.clone();
    if let Err(e) = app.run_on_main_thread(move || setup_calendar(&handle, &window)) {
      log::error!("failed to set up calendar window: {e}");
    }
  });
}

/// 새로 만든 캘린더 창(시작할 때와 다시 열 때)을 바탕화면에 붙인다. 실패하면 일반 창으로 띄운다.
fn setup_calendar(app: &AppHandle, window: &WebviewWindow) {
  #[cfg(windows)]
  if let Err(e) = pin_to_desktop(app, window) {
    log::error!("failed to pin to desktop: {e}");
    let _ = window.set_decorations(true);
    let _ = window.set_skip_taskbar(false);
    let _ = window.show();
  }
  #[cfg(not(windows))]
  {
    let _ = app;
    let _ = window.show();
  }
}

fn show_calendar(window: &WebviewWindow) -> tauri::Result<()> {
  window.show()?;
  // show()가 tao의 창 스타일을 다시 써서 제목 표시줄 스타일이 돌아오므로 다시 지운다
  #[cfg(windows)]
  if let Ok(hwnd) = window.hwnd()
    && desktop::is_attached(hwnd)
  {
    desktop::strip_frame(hwnd);
  }
  Ok(())
}

/// 캘린더 창을 바탕화면에 붙이고, 사용자가 옮기거나 크기를 바꾸면 위치를 저장한다.
#[cfg(windows)]
fn pin_to_desktop(app: &AppHandle, window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
  use layout::ScreenRect;
  use tauri::WindowEvent;

  let path = app.path().app_config_dir()?.join("layout.json");

  let primary = window.primary_monitor()?.ok_or("primary monitor not found")?;
  let work = primary.work_area();
  let monitors: Vec<ScreenRect> = window
    .available_monitors()?
    .iter()
    .map(|m| ScreenRect {
      x: m.position().x,
      y: m.position().y,
      width: m.size().width as i32,
      height: m.size().height as i32,
    })
    .collect();
  let rect = layout::resolve(
    layout::load(&path),
    &monitors,
    ScreenRect {
      x: work.position.x,
      y: work.position.y,
      width: work.size.width as i32,
      height: work.size.height as i32,
    },
    primary.scale_factor(),
  );

  desktop::attach(window.hwnd()?, &rect)?;
  show_calendar(window)?;
  log::info!("pinned to desktop at {rect:?}");

  let saver = layout::DebouncedSaver::new(path);
  let w = window.clone();
  window.on_window_event(move |event| {
    if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_))
      && let Some(rect) = w.hwnd().ok().and_then(desktop::screen_rect)
    {
      saver.schedule(rect);
    }
  });
  Ok(())
}

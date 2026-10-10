mod layout;

#[cfg(windows)]
mod desktop;

use tauri::{AppHandle, Manager, WebviewWindow};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
      #[cfg(windows)]
      if let Err(e) = pin_to_desktop(app) {
        // 고정에 실패해도 일반 창으로라도 띄운다
        log::error!("failed to pin to desktop: {e}");
        if let Some(window) = app.get_webview_window("main") {
          window.set_decorations(true)?;
          window.set_skip_taskbar(false)?;
          window.show()?;
        }
      }
      setup_tray(app)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

/// 트레이 아이콘. 왼쪽 클릭은 캘린더 보이기/숨기기, 오른쪽 클릭 메뉴에는 설정과 종료가 있다.
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
  use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
  use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

  let toggle = MenuItem::with_id(app, "toggle", "보이기/숨기기", true, None::<&str>)?;
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
  let Some(window) = app.get_webview_window("main") else {
    return;
  };
  let result = if window.is_visible().unwrap_or(false) {
    window.hide()
  } else {
    show_calendar(&window)
  };
  if let Err(e) = result {
    log::error!("failed to toggle calendar: {e}");
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

/// 메인 창을 바탕화면에 붙이고, 사용자가 옮기거나 크기를 바꾸면 위치를 저장한다.
#[cfg(windows)]
fn pin_to_desktop(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  use layout::ScreenRect;
  use tauri::WindowEvent;

  let window = app.get_webview_window("main").ok_or("main window not found")?;
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
  show_calendar(&window)?;
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

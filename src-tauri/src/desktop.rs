//! 창을 바탕화면 아이콘 레이어(SHELLDLL_DefView) 안, 아이콘 목록보다 위에 붙인다.
//!
//! 아이콘 뒤(WorkerW)에 두면 아이콘 레이어가 화면 전체를 덮고 있어 캘린더를 클릭할 수 없다.
//! 아이콘 레이어의 자식으로 두면 클릭과 키보드 입력을 그대로 받고 Win+D(바탕화면 보기)에도
//! 남는다. 대신 캘린더가 차지한 영역의 아이콘은 가려진다.

use crate::layout::ScreenRect;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::ScreenToClient;
use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
  EnumWindows, FindWindowExW, FindWindowW, GA_PARENT, GWL_EXSTYLE, GWL_STYLE, GetAncestor,
  GetDesktopWindow, GetWindowLongPtrW, GetWindowRect, HWND_TOP, SWP_FRAMECHANGED, SWP_NOACTIVATE,
  SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SetParent, SetWindowLongPtrW, SetWindowPos, WM_NCACTIVATE,
  WM_NCPAINT, WS_CAPTION, WS_EX_APPWINDOW, WS_EX_WINDOWEDGE, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
  WS_SYSMENU,
};
use windows::core::{BOOL, PCWSTR, w};

/// `hwnd`를 아이콘 레이어의 자식으로 붙이고 화면 좌표 `rect`에 둔다.
/// 창을 보이게 하기 전에 불러야 제목 표시줄이 한 번도 그려지지 않는다.
pub fn attach(hwnd: HWND, rect: &ScreenRect) -> Result<(), String> {
  let defview = find_defview().ok_or("desktop icon view (SHELLDLL_DefView) not found")?;
  unsafe {
    if !SetWindowSubclass(hwnd, Some(suppress_frame_painting), 1, 0).as_bool() {
      return Err("SetWindowSubclass failed".into());
    }
    // SetParent의 반환값(이전 부모)은 믿기 어려워 실제 부모로 확인한다.
    // GetParent는 WS_CHILD가 없는 창에 대해 소유자를 돌려주므로 GetAncestor를 쓴다.
    let _ = SetParent(hwnd, Some(defview));
    if GetAncestor(hwnd, GA_PARENT) != defview {
      return Err("SetParent did not reparent the window".into());
    }
  }
  move_to(hwnd, rect)
}

/// 바탕화면에 붙어 있는지(부모가 데스크톱 창이 아닌지). 고정에 실패해 일반 창으로 뜬 경우 false.
pub fn is_attached(hwnd: HWND) -> bool {
  unsafe { GetAncestor(hwnd, GA_PARENT) != GetDesktopWindow() }
}

/// 화면 좌표 `rect`로 옮기고 아이콘 목록보다 위에 둔다.
pub fn move_to(hwnd: HWND, rect: &ScreenRect) -> Result<(), String> {
  unsafe {
    // 자식 창 좌표는 부모 기준이다. 아이콘 레이어는 모든 모니터를 합친 영역을 덮고
    // 그 왼쪽 위가 기준점이라, 주 모니터의 (0, 0)과 다를 수 있다.
    let parent = GetAncestor(hwnd, GA_PARENT);
    let mut origin = POINT { x: rect.x, y: rect.y };
    let _ = ScreenToClient(parent, &mut origin);
    SetWindowPos(
      hwnd,
      Some(HWND_TOP),
      origin.x,
      origin.y,
      rect.width,
      rect.height,
      SWP_NOACTIVATE,
    )
    .map_err(|e| e.to_string())
  }
}

/// 제목 표시줄 관련 스타일을 지운다.
///
/// tao는 테두리 없는 창에도 이 스타일을 남겨 두고 비클라이언트 영역만 0으로 만든다. 일반 창은
/// DWM이 처리해 주지만, 바탕화면의 자식 창에서는 Windows가 활성화될 때마다 옛날식 제목
/// 표시줄을 내용 위에 덧그린다. tao는 창 상태가 바뀔 때(show/hide 등) 스타일을 다시
/// 계산해 덮어쓰므로, 그런 호출 뒤에는 이 함수를 다시 불러야 한다.
///
/// WS_THICKFRAME(WS_SIZEBOX)은 남긴다. Tauri의 테두리 없는 창 가장자리 크기 조절이 이 스타일이
/// 있을 때만 동작한다. 테두리 그리기는 suppress_frame_painting이 막는다.
pub fn strip_frame(hwnd: HWND) {
  let frame = (WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX).0;
  let frame_ex = (WS_EX_WINDOWEDGE | WS_EX_APPWINDOW).0;
  unsafe {
    let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
    SetWindowLongPtrW(hwnd, GWL_STYLE, (style & !frame) as isize);
    let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (ex & !frame_ex) as isize);
    let _ = SetWindowPos(
      hwnd,
      None,
      0,
      0,
      0,
      0,
      SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
    );
  }
}

/// 비클라이언트 영역(제목 표시줄·테두리) 그리기를 막는다. strip_frame으로 스타일을 지우기 전,
/// 또는 tao가 스타일을 다시 쓴 직후에도 Windows가 내용 위에 제목 표시줄을 덧그리지 않게 한다.
/// 한 번 그려진 흔적은 투명 영역이라 다시 칠해지지 않으므로 아예 그리지 못하게 해야 한다.
unsafe extern "system" fn suppress_frame_painting(
  hwnd: HWND,
  msg: u32,
  wparam: WPARAM,
  lparam: LPARAM,
  _id: usize,
  _data: usize,
) -> LRESULT {
  unsafe {
    match msg {
      WM_NCPAINT => LRESULT(0),
      // lParam이 -1이면 활성 상태만 바꾸고 비클라이언트 영역은 다시 그리지 않는다
      WM_NCACTIVATE => DefSubclassProc(hwnd, msg, wparam, LPARAM(-1)),
      _ => DefSubclassProc(hwnd, msg, wparam, lparam),
    }
  }
}

pub fn screen_rect(hwnd: HWND) -> Option<ScreenRect> {
  let mut r = RECT::default();
  unsafe { GetWindowRect(hwnd, &mut r) }.ok()?;
  Some(ScreenRect { x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top })
}

fn find_defview() -> Option<HWND> {
  unsafe {
    if let Ok(progman) = FindWindowW(w!("Progman"), PCWSTR::null())
      && let Ok(defview) = FindWindowExW(Some(progman), None, w!("SHELLDLL_DefView"), PCWSTR::null())
    {
      return Some(defview);
    }
    // Windows 11 24H2 이전에는 배경화면 슬라이드쇼 등이 WorkerW를 만들면
    // 아이콘 레이어가 최상위 WorkerW 아래로 옮겨간다
    let mut found = HWND::default();
    let _ = EnumWindows(Some(find_in_top_level), LPARAM(&mut found as *mut HWND as isize));
    (!found.is_invalid()).then_some(found)
  }
}

unsafe extern "system" fn find_in_top_level(hwnd: HWND, lparam: LPARAM) -> BOOL {
  unsafe {
    if let Ok(defview) = FindWindowExW(Some(hwnd), None, w!("SHELLDLL_DefView"), PCWSTR::null()) {
      *(lparam.0 as *mut HWND) = defview;
      return BOOL(0);
    }
    BOOL(1)
  }
}

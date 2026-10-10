//! 캘린더 창의 위치·크기 저장과 복원

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::{fs, io, thread};

/// 화면 기준 물리 픽셀 좌표. 주 모니터 왼쪽 위가 (0, 0)이고, 다른 모니터는 음수일 수 있다.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScreenRect {
  pub x: i32,
  pub y: i32,
  pub width: i32,
  pub height: i32,
}

impl ScreenRect {
  fn overlaps_enough(&self, other: &ScreenRect) -> bool {
    let w = (self.x + self.width).min(other.x + other.width) - self.x.max(other.x);
    let h = (self.y + self.height).min(other.y + other.height) - self.y.max(other.y);
    w >= MIN_VISIBLE && h >= MIN_VISIBLE
  }
}

// 저장된 위치가 모니터와 이만큼도 겹치지 않으면(모니터가 빠졌거나 화면 밖) 기본 위치로 돌아간다
const MIN_VISIBLE: i32 = 100;
// 기본 크기와 여백(논리 픽셀). 모니터 배율을 곱해 물리 픽셀로 쓴다.
const DEFAULT_WIDTH: f64 = 1080.0;
const DEFAULT_HEIGHT: f64 = 760.0;
const DEFAULT_MARGIN: f64 = 24.0;

/// 저장된 위치를 쓸 수 있으면 그대로, 아니면 주 모니터 작업 영역의 오른쪽 위에 기본 크기로.
pub fn resolve(
  saved: Option<ScreenRect>,
  monitors: &[ScreenRect],
  primary_work_area: ScreenRect,
  scale: f64,
) -> ScreenRect {
  if let Some(rect) = saved
    && rect.width > 0
    && rect.height > 0
    && monitors.iter().any(|m| rect.overlaps_enough(m))
  {
    return rect;
  }
  let work = primary_work_area;
  let margin = (DEFAULT_MARGIN * scale) as i32;
  let width = ((DEFAULT_WIDTH * scale) as i32).min(work.width - 2 * margin);
  let height = ((DEFAULT_HEIGHT * scale) as i32).min(work.height - 2 * margin);
  ScreenRect {
    x: work.x + work.width - width - margin,
    y: work.y + margin,
    width,
    height,
  }
}

pub fn load(path: &Path) -> Option<ScreenRect> {
  serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

pub fn save(path: &Path, rect: &ScreenRect) -> io::Result<()> {
  if let Some(dir) = path.parent() {
    fs::create_dir_all(dir)?;
  }
  fs::write(path, serde_json::to_string_pretty(rect)?)
}

/// 드래그하는 동안에는 이동 이벤트가 연달아 오므로, 마지막 값만 잠시 뒤에 한 번 저장한다.
#[derive(Clone)]
pub struct DebouncedSaver {
  path: Arc<PathBuf>,
  pending: Arc<Mutex<Option<ScreenRect>>>,
}

impl DebouncedSaver {
  pub fn new(path: PathBuf) -> Self {
    Self { path: Arc::new(path), pending: Arc::new(Mutex::new(None)) }
  }

  pub fn schedule(&self, rect: ScreenRect) {
    let mut pending = self.pending.lock().unwrap();
    let already_scheduled = pending.is_some();
    *pending = Some(rect);
    if already_scheduled {
      return;
    }
    let this = self.clone();
    thread::spawn(move || {
      thread::sleep(Duration::from_millis(500));
      let latest = this.pending.lock().unwrap().take();
      if let Some(rect) = latest
        && let Err(e) = save(&this.path, &rect)
      {
        log::error!("failed to save layout: {e}");
      }
    });
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  const PRIMARY: ScreenRect = ScreenRect { x: 0, y: 0, width: 1920, height: 1080 };
  const PRIMARY_WORK: ScreenRect = ScreenRect { x: 0, y: 0, width: 1920, height: 1032 };
  const LEFT: ScreenRect = ScreenRect { x: -1920, y: 5, width: 1920, height: 1080 };

  #[test]
  fn keeps_saved_rect_on_a_connected_monitor() {
    let saved = ScreenRect { x: -1500, y: 100, width: 800, height: 600 };
    assert_eq!(resolve(Some(saved), &[PRIMARY, LEFT], PRIMARY_WORK, 1.25), saved);
  }

  #[test]
  fn falls_back_when_saved_monitor_is_gone() {
    let saved = ScreenRect { x: -1500, y: 100, width: 800, height: 600 };
    let rect = resolve(Some(saved), &[PRIMARY], PRIMARY_WORK, 1.25);
    assert_ne!(rect, saved);
    assert!(rect.overlaps_enough(&PRIMARY));
  }

  #[test]
  fn falls_back_when_only_a_sliver_is_visible() {
    let saved = ScreenRect { x: 1900, y: 100, width: 800, height: 600 };
    assert_ne!(resolve(Some(saved), &[PRIMARY], PRIMARY_WORK, 1.0), saved);
  }

  #[test]
  fn default_is_top_right_of_primary_work_area_scaled() {
    let rect = resolve(None, &[PRIMARY], PRIMARY_WORK, 1.25);
    assert_eq!(rect, ScreenRect { x: 1920 - 1350 - 30, y: 30, width: 1350, height: 950 });
  }

  #[test]
  fn default_shrinks_to_fit_small_work_area() {
    let small = ScreenRect { x: 0, y: 0, width: 1024, height: 700 };
    let rect = resolve(None, &[small], small, 1.0);
    assert_eq!(rect, ScreenRect { x: 24, y: 24, width: 1024 - 48, height: 700 - 48 });
  }
}

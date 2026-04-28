use tauri::Manager;

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg(target_os = "windows")]
#[derive(Clone, Copy, Debug)]
struct DesktopRect {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

const REMOTE_APP_URL: &str = "https://planner-project-eight.vercel.app";
const EXTERNAL_OPEN_BRIDGE_SCRIPT: &str = r#"
(() => {
  if (window.__plannerExternalOpenPatched) {
    return;
  }

  window.__plannerExternalOpenPatched = true;
  const originalOpen = window.open.bind(window);

  window.open = function patchedOpen(url, target, features) {
    try {
      const candidate = typeof url === 'string' || url instanceof URL ? String(url) : '';
      if (candidate) {
        const resolved = new URL(candidate, window.location.href);
        if (
          resolved.origin !== window.location.origin &&
          (resolved.protocol === 'http:' || resolved.protocol === 'https:')
        ) {
          const invoke = window.__TAURI_INTERNALS__?.invoke;
          if (typeof invoke === 'function') {
            invoke('open_external_url', { url: resolved.toString() }).catch((error) => {
              console.error('external open bridge failed', error);
            });
            return {
              closed: false,
              focus() {},
              close() {},
            };
          }
        }
      }
    } catch (error) {
      console.error('external open patch failed', error);
    }

    return originalOpen(url, target, features);
  };
})();
"#;

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let parsed = tauri::Url::parse(&url).map_err(|error| format!("invalid url: {error}"))?;
    match parsed.scheme() {
        "http" | "https" => {}
        scheme => return Err(format!("unsupported url scheme: {scheme}")),
    }

    open::that_detached(parsed.as_str())
        .map_err(|error| format!("failed to open external url: {error}"))
}

fn navigate_main_window_to_remote(window: &tauri::WebviewWindow) {
    match tauri::Url::parse(REMOTE_APP_URL) {
        Ok(url) => {
            if let Err(error) = window.navigate(url) {
                eprintln!("remote navigation failed: {error}");
            }
        }
        Err(error) => {
            eprintln!("invalid remote app url: {error}");
        }
    }
}

fn install_external_open_bridge<R: tauri::Runtime>(webview: &tauri::Webview<R>) {
    if let Err(error) = webview.eval(EXTERNAL_OPEN_BRIDGE_SCRIPT) {
        eprintln!("external open bridge injection failed: {error}");
    }
}

#[cfg(target_os = "windows")]
fn same_monitor(a: &tauri::Monitor, b: &tauri::Monitor) -> bool {
    let ap = a.position();
    let asz = a.size();
    let bp = b.position();
    let bsz = b.size();
    ap.x == bp.x && ap.y == bp.y && asz.width == bsz.width && asz.height == bsz.height
}

#[cfg(target_os = "windows")]
fn pick_target_monitor_index(
    monitors: &[tauri::Monitor],
    primary: Option<&tauri::Monitor>,
) -> usize {
    if monitors.len() == 1 {
        return 0;
    }

    if let Some(primary_monitor) = primary {
        if let Some((idx, _)) = monitors
            .iter()
            .enumerate()
            .find(|(_, monitor)| !same_monitor(monitor, primary_monitor))
        {
            return idx;
        }
    }

    1
}

#[cfg(target_os = "windows")]
fn monitor_work_rect(monitor: &tauri::Monitor) -> Option<DesktopRect> {
    use std::mem::size_of;
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    let pos = monitor.position();
    let size = monitor.size();
    let center_x = pos.x.saturating_add((size.width / 2) as i32);
    let center_y = pos.y.saturating_add((size.height / 2) as i32);

    let handle = unsafe {
        MonitorFromPoint(
            POINT {
                x: center_x,
                y: center_y,
            },
            MONITOR_DEFAULTTONEAREST,
        )
    };
    if handle.is_invalid() {
        return None;
    }

    let mut info = MONITORINFO::default();
    info.cbSize = size_of::<MONITORINFO>() as u32;

    let ok = unsafe { GetMonitorInfoW(handle, &mut info).as_bool() };
    if !ok {
        return None;
    }

    let work = info.rcWork;
    let width = (work.right - work.left).max(1);
    let height = (work.bottom - work.top).max(1);

    Some(DesktopRect {
        x: work.left,
        y: work.top,
        width,
        height,
    })
}

#[cfg(target_os = "windows")]
fn target_desktop_rect(window: &tauri::WebviewWindow) -> tauri::Result<Option<DesktopRect>> {
    let monitors = window.available_monitors()?;
    if monitors.is_empty() {
        return Ok(None);
    }

    let primary = window.primary_monitor()?;
    let target_idx = pick_target_monitor_index(&monitors, primary.as_ref());
    let target = &monitors[target_idx];

    if let Some(work_rect) = monitor_work_rect(target) {
        return Ok(Some(work_rect));
    }

    let pos = target.position();
    let size = target.size();
    Ok(Some(DesktopRect {
        x: pos.x,
        y: pos.y,
        width: (size.width as i32).max(1),
        height: (size.height as i32).max(1),
    }))
}

#[cfg(target_os = "windows")]
fn wait_for_target_desktop_rect(window: &tauri::WebviewWindow) -> tauri::Result<DesktopRect> {
    use std::{thread, time::Duration};

    for _ in 0..20 {
        if let Some(rect) = target_desktop_rect(window)? {
            return Ok(rect);
        }
        thread::sleep(Duration::from_millis(200));
    }

    Ok(DesktopRect {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
    })
}

#[cfg(target_os = "windows")]
fn configure_interactive_wallpaper_window(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use tauri::{PhysicalPosition, PhysicalSize, Position, Size};

    let rect = wait_for_target_desktop_rect(window)?;

    // Use always-on-bottom top-level mode so keyboard input works reliably.
    window.set_always_on_top(false)?;
    window.set_always_on_bottom(true)?;
    window.set_skip_taskbar(true)?;
    window.set_decorations(false)?;
    window.set_resizable(false)?;
    window.set_fullscreen(false)?;
    window.set_ignore_cursor_events(false)?;
    window.set_position(Position::Physical(PhysicalPosition::new(rect.x, rect.y)))?;
    window.set_size(Size::Physical(PhysicalSize::new(
        rect.width as u32,
        rect.height as u32,
    )))?;
    window.show()?;
    window.unminimize()?;
    window.set_focus()?;

    Ok(())
}

#[cfg(desktop)]
fn focus_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(desktop)]
fn setup_tray_icon<R: tauri::Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "tray_open", "열기", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "tray_quit", "종료", true, None::<&str>)?;
    let tray_menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    let mut tray_builder = TrayIconBuilder::with_id("main")
        .menu(&tray_menu)
        .tooltip("Planner Floating")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray_open" => focus_main_window(app),
            "tray_quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button,
                button_state,
                ..
            } = event
            {
                if button == MouseButton::Left && button_state == MouseButtonState::Up {
                    focus_main_window(tray.app_handle());
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    let _ = tray_builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_external_url])
        .on_page_load(|window, _payload| {
            install_external_open_bridge(window);
        })
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::MacosLauncher;
                use tauri_plugin_autostart::ManagerExt;

                app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    Some(vec![]),
                ))?;

                let autostart_manager = app.autolaunch();
                if let Err(error) = autostart_manager.enable() {
                    eprintln!("autostart enable failed: {error}");
                }
            }

            #[cfg(desktop)]
            {
                if let Err(error) = setup_tray_icon(app) {
                    eprintln!("tray icon setup failed: {error}");
                }
            }

            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    navigate_main_window_to_remote(&window);

                    if let Err(error) = configure_interactive_wallpaper_window(&window) {
                        eprintln!("interactive wallpaper setup failed: {error}");
                    }
                }
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

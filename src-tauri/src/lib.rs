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

const FLOATING_RESET_BUTTON_SCRIPT: &str = r#"
(() => {
  if (window.__plannerFloatingResetButtonInstalled) {
    return;
  }
  window.__plannerFloatingResetButtonInstalled = true;

  const install = () => {
    const invoke = window.__TAURI_INTERNALS__?.invoke;
    if (typeof invoke !== 'function') {
      window.requestAnimationFrame(install);
      return;
    }

    if (!document.body) {
      window.requestAnimationFrame(install);
      return;
    }

    if (document.getElementById('planner-floating-reset-button')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'planner-floating-reset-button';
    button.type = 'button';
    button.title = 'Reset floating position';
    button.setAttribute('aria-label', 'Reset floating window position');
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 9V3h6"></path>
        <path d="M21 15v6h-6"></path>
        <path d="M3 3l7 7"></path>
        <path d="M21 21l-7-7"></path>
      </svg>
    `;

    Object.assign(button.style, {
      alignItems: 'center',
      backdropFilter: 'blur(14px)',
      background: 'rgba(13, 11, 20, 0.88)',
      border: '1px solid rgba(167, 139, 250, 0.34)',
      borderRadius: '9999px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.24)',
      color: '#d8d3ff',
      cursor: 'pointer',
      display: 'flex',
      height: '32px',
      justifyContent: 'center',
      padding: '0',
      position: 'fixed',
      right: '8px',
      top: '8px',
      transition: 'border-color 140ms ease, color 140ms ease, opacity 140ms ease, transform 140ms ease',
      width: '32px',
      zIndex: '2147483647',
    });

    let stateTimer = 0;
    const setState = (state) => {
      window.clearTimeout(stateTimer);
      button.disabled = state === 'pending';
      button.style.cursor = state === 'pending' ? 'wait' : 'pointer';
      button.style.opacity = state === 'pending' ? '0.7' : '1';
      button.style.transform = state === 'pending' ? 'scale(0.96)' : 'scale(1)';

      if (state === 'done') {
        button.style.borderColor = '#7bf1a8';
        button.style.color = '#7bf1a8';
      } else if (state === 'error') {
        button.style.borderColor = '#fb7185';
        button.style.color = '#fb7185';
      } else {
        button.style.borderColor = 'rgba(167, 139, 250, 0.34)';
        button.style.color = '#d8d3ff';
      }

      if (state === 'done' || state === 'error') {
        stateTimer = window.setTimeout(() => setState('idle'), 1400);
      }
    };

    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        button.style.borderColor = 'rgba(167, 139, 250, 0.72)';
        button.style.transform = 'scale(1.05)';
      }
    });
    button.addEventListener('mouseleave', () => {
      if (!button.disabled) {
        setState('idle');
      }
    });
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (button.disabled) {
        return;
      }

      setState('pending');
      try {
        await invoke('reset_floating_window_position');
        setState('done');
      } catch (error) {
        console.error('[FloatingWindow] Position reset failed:', error);
        setState('error');
      }
    });

    document.body.append(button);
  };

  install();
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

#[tauri::command]
fn reset_floating_window_position(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "main window was not found".to_string())?;

        configure_interactive_wallpaper_window(&window)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Ok(())
    }
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

fn install_floating_reset_button<R: tauri::Runtime>(webview: &tauri::Webview<R>) {
    if let Err(error) = webview.eval(FLOATING_RESET_BUTTON_SCRIPT) {
        eprintln!("floating reset button injection failed: {error}");
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
fn align_window_client_to_desktop_rect(
    window: &tauri::WebviewWindow,
    rect: DesktopRect,
) -> Result<(), String> {
    use windows::Win32::{
        Foundation::{POINT, RECT},
        Graphics::Gdi::ClientToScreen,
        UI::WindowsAndMessaging::{
            GetClientRect, GetWindowRect, SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER,
            SWP_SHOWWINDOW,
        },
    };

    let hwnd = window
        .hwnd()
        .map_err(|error| format!("failed to get window handle: {error}"))?;

    let mut window_rect = RECT::default();
    let mut client_rect = RECT::default();
    let mut client_origin = POINT { x: 0, y: 0 };

    unsafe {
        GetWindowRect(hwnd, &mut window_rect)
            .map_err(|error| format!("failed to read window rect: {error}"))?;
        GetClientRect(hwnd, &mut client_rect)
            .map_err(|error| format!("failed to read client rect: {error}"))?;
        if !ClientToScreen(hwnd, &mut client_origin).as_bool() {
            return Err(format!(
                "failed to map client rect: {}",
                windows::core::Error::from_win32()
            ));
        }
    }

    let left_inset = client_origin.x - window_rect.left;
    let top_inset = client_origin.y - window_rect.top;
    let right_inset = window_rect.right - (client_origin.x + client_rect.right);
    let bottom_inset = window_rect.bottom - (client_origin.y + client_rect.bottom);
    let outer_x = rect.x - left_inset;
    let outer_y = rect.y - top_inset;
    let outer_width = (rect.width + left_inset + right_inset).max(1);
    let outer_height = (rect.height + top_inset + bottom_inset).max(1);

    unsafe {
        SetWindowPos(
            hwnd,
            None,
            outer_x,
            outer_y,
            outer_width,
            outer_height,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
        .map_err(|error| format!("failed to align window with Win32: {error}"))?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn apply_desktop_rect_to_window(
    window: &tauri::WebviewWindow,
    rect: DesktopRect,
) -> Result<(), String> {
    use tauri::{PhysicalPosition, PhysicalSize, Position, Size};

    window
        .set_size(Size::Physical(PhysicalSize::new(
            rect.width as u32,
            rect.height as u32,
        )))
        .map_err(|error| format!("failed to resize window: {error}"))?;

    if let Err(error) = align_window_client_to_desktop_rect(window, rect) {
        eprintln!("native window alignment failed: {error}");
        window
            .set_position(Position::Physical(PhysicalPosition::new(rect.x, rect.y)))
            .map_err(|error| format!("failed to position window: {error}"))?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn configure_interactive_wallpaper_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    let rect = wait_for_target_desktop_rect(window).map_err(|error| error.to_string())?;

    // Use always-on-bottom top-level mode so keyboard input works reliably.
    window
        .set_always_on_top(false)
        .map_err(|error| error.to_string())?;
    window
        .set_always_on_bottom(true)
        .map_err(|error| error.to_string())?;
    window
        .set_skip_taskbar(true)
        .map_err(|error| error.to_string())?;
    window
        .set_decorations(false)
        .map_err(|error| error.to_string())?;
    window
        .set_resizable(false)
        .map_err(|error| error.to_string())?;
    window
        .set_fullscreen(false)
        .map_err(|error| error.to_string())?;
    window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    apply_desktop_rect_to_window(window, rect)?;
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

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
        .invoke_handler(tauri::generate_handler![
            open_external_url,
            reset_floating_window_position
        ])
        .on_page_load(|window, _payload| {
            install_external_open_bridge(window);
            install_floating_reset_button(window);
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

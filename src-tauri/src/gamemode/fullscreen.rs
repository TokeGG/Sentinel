//! Foreground-fullscreen detection (Windows only; stub elsewhere). The pure
//! decision (`is_fullscreen_game`, `is_shell_class`) lives in decide.rs.

#[cfg(windows)]
pub fn fullscreen_foreground() -> bool {
    use super::decide::{is_fullscreen_game, is_shell_class};
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    use windows_sys::Win32::System::Threading::GetCurrentProcessId;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetDesktopWindow, GetForegroundWindow, GetShellWindow, GetWindowLongW, GetWindowRect,
        GetWindowThreadProcessId, GWL_STYLE, WS_CAPTION,
    };
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() || hwnd == GetDesktopWindow() || hwnd == GetShellWindow() {
            return false;
        }
        // Our own window (even maximized) is never "a game".
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == GetCurrentProcessId() {
            return false;
        }
        let mut cls = [0u16; 64];
        let n = GetClassNameW(hwnd, cls.as_mut_ptr(), cls.len() as i32).max(0) as usize;
        if is_shell_class(&String::from_utf16_lossy(&cls[..n])) {
            return false;
        }
        let framed = (GetWindowLongW(hwnd, GWL_STYLE) as u32 & WS_CAPTION) == WS_CAPTION;
        let mut wr: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut wr) == 0 {
            return false;
        }
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mut mi) == 0 {
            return false;
        }
        let m = mi.rcMonitor;
        is_fullscreen_game((wr.left, wr.top, wr.right, wr.bottom), (m.left, m.top, m.right, m.bottom), framed)
    }
}
#[cfg(not(windows))]
pub fn fullscreen_foreground() -> bool {
    false
}

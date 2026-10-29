//! String builders for the JS handed to the bot browser. The driver itself lives in driver.js.
const DRIVER: &str = include_str!("driver.js");

/// Initialization script for one window session; `nonce` keeps pages from forging title messages.
pub fn init_script(nonce: &str) -> String {
    DRIVER.replace("__NONCE__", nonce)
}
/// eval payload: run `js` (a window.__sb.* call) and send its value or error back under `id`.
pub fn run_script(id: &str, js: &str) -> String {
    let id = serde_json::to_string(id).unwrap_or_else(|_| "\"\"".into());
    format!("if(window.__sb)window.__sb.__run({id},async()=>({js}));")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn init_script_embeds_the_nonce_once_and_defines_the_driver() {
        let s = init_script("abc123");
        assert!(!s.contains("__NONCE__"));
        assert!(s.contains("PFX + \"abc123:\""));
        for needle in ["window, \"__sb\"", "const observe", "const act", "td.set.call", "never typed"] {
            assert!(s.contains(needle), "{needle}");
        }
    }
    #[test]
    fn run_script_quotes_the_id_and_wraps_the_call() {
        let s = run_script("r-1", "window.__sb.observe()");
        assert_eq!(s, "if(window.__sb)window.__sb.__run(\"r-1\",async()=>(window.__sb.observe()));");
        assert!(run_script("a\"b", "window.__sb.x()").contains("\"a\\\"b\""));
    }
}

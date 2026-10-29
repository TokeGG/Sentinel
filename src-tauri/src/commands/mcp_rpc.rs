// Pure JSON-RPC 2.0 framing for MCP over stdio: one JSON message per line.
use serde_json::{json, Value};

pub const PROTOCOL: &str = "2024-11-05";

pub fn request(id: u64, method: &str, params: Value) -> String {
    json!({"jsonrpc": "2.0", "id": id, "method": method, "params": params}).to_string()
}

pub fn notification(method: &str) -> String {
    json!({"jsonrpc": "2.0", "method": method}).to_string()
}

pub fn initialize_params() -> Value {
    json!({"protocolVersion": PROTOCOL, "capabilities": {}, "clientInfo": {"name": "sentinel", "version": "0.1.0"}})
}

#[derive(Debug, PartialEq)]
pub enum Msg {
    /// A reply to one of our requests (`Err` carries the server's error message).
    Response(u64, Result<Value, String>),
    /// Notifications, server-initiated requests, noise: ignored by the client.
    Other,
}

/// None = not JSON-RPC at all (e.g. a stray log line on stdout).
pub fn parse_line(line: &str) -> Option<Msg> {
    let v: Value = serde_json::from_str(line.trim()).ok()?;
    if v.get("jsonrpc")? != "2.0" {
        return None;
    }
    if v.get("method").is_some() {
        return Some(Msg::Other);
    }
    let id = v.get("id")?.as_u64()?;
    if let Some(err) = v.get("error") {
        let m = err.get("message").and_then(Value::as_str).unwrap_or("unknown error");
        return Some(Msg::Response(id, Err(m.to_string())));
    }
    Some(Msg::Response(id, Ok(v.get("result").cloned().unwrap_or(Value::Null))))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_are_single_lines() {
        let r = request(7, "tools/list", json!({"a": "x\ny"}));
        assert!(!r.contains('\n'));
        assert_eq!(serde_json::from_str::<Value>(&r).unwrap()["id"], 7);
        assert!(!notification("notifications/initialized").contains("\"id\""));
    }

    #[test]
    fn parses_responses_errors_and_noise() {
        assert_eq!(parse_line(r#"{"jsonrpc":"2.0","id":3,"result":{"ok":1}}"#), Some(Msg::Response(3, Ok(json!({"ok": 1})))));
        assert_eq!(parse_line(r#"{"jsonrpc":"2.0","id":4,"error":{"code":-1,"message":"nope"}}"#), Some(Msg::Response(4, Err("nope".into()))));
        assert_eq!(parse_line(r#"{"jsonrpc":"2.0","method":"notifications/message"}"#), Some(Msg::Other));
        assert_eq!(parse_line(r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#), Some(Msg::Other));
        for junk in ["", "hello", "{not json", r#"{"id":1,"result":1}"#, r#"{"jsonrpc":"2.0","id":"x","result":1}"#] {
            assert_eq!(parse_line(junk), None, "{junk}");
        }
    }
}

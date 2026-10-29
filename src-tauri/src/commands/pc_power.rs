// Power plans via `powercfg` with fixed args (Windows only; elsewhere an error). GUID validated before use.
use serde::Serialize;

#[derive(Serialize, Debug, PartialEq)]
pub struct Plan { guid: String, name: String, active: bool }

/// Parses `powercfg /list` lines: "Power Scheme GUID: 381b...  (Balanced) *".
pub fn parse_plans(text: &str) -> Vec<Plan> {
    let re = regex_lite::Regex::new(r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s+\(([^)]*)\)(\s*\*)?").unwrap();
    text.lines()
        .filter_map(|l| re.captures(l))
        .map(|c| Plan { guid: c[1].to_lowercase(), name: c[2].to_string(), active: c.get(3).is_some() })
        .collect()
}

pub fn valid_guid(g: &str) -> bool {
    regex_lite::Regex::new(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").unwrap().is_match(g)
}

#[tauri::command]
pub async fn power_plans() -> Result<Vec<Plan>, String> {
    if !cfg!(windows) { return Err("power plans are Windows-only".into()) }
    super::pc_cmd::blocking(|| Ok(parse_plans(&super::pc_cmd::run_fixed("powercfg", &["/list"])?))).await
}

#[tauri::command]
pub async fn set_power_plan(guid: String) -> Result<(), String> {
    if !cfg!(windows) { return Err("power plans are Windows-only".into()) }
    let g = guid.to_lowercase();
    if !valid_guid(&g) { return Err("not a power plan id".into()) }
    let known = super::pc_cmd::blocking(|| Ok(parse_plans(&super::pc_cmd::run_fixed("powercfg", &["/list"])?))).await?;
    if !known.iter().any(|p| p.guid == g) { return Err("unknown power plan".into()) }
    super::pc_cmd::blocking(move || super::pc_cmd::run_fixed("powercfg", &["/setactive", &g]).map(|_| ())).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_list() {
        let t = "Existing Power Schemes (* Active)\n-----\nPower Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *\nPower Scheme GUID: 8C5E7FDA-E8BF-4A96-9A85-A6E23A8C635C  (High performance)\n";
        let p = parse_plans(t);
        assert_eq!(p.len(), 2);
        assert!(p[0].active && !p[1].active);
        assert_eq!(p[1].guid, "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c");
        assert!(valid_guid(&p[1].guid));
        assert!(!valid_guid("x & calc"));
    }
}

// Advent of Code page/input fetch for the bot Challenge Coach. GET only (never submits), fixed host and paths,
// validated year/day/cookie, descriptive User-Agent. Caching and spacing between requests live in the TS caller.
use super::http_out::{client, read, HttpOut};
use tauri_plugin_http::reqwest::header::{COOKIE, USER_AGENT};

pub const UA: &str = "Sentinel-ChallengeCoach/0.1 (personal local desktop app; fetches each puzzle and input once, caches them)";

pub fn aoc_url(year: u32, day: u32, input: bool) -> Result<String, String> {
    if !(2015..=2100).contains(&year) || !(1..=25).contains(&day) {
        return Err("year must be 2015+ and day 1-25".into());
    }
    Ok(format!("https://adventofcode.com/{year}/day/{day}{}", if input { "/input" } else { "" }))
}

pub fn cookie_ok(c: &str) -> bool {
    (32..=256).contains(&c.len()) && c.chars().all(|ch| ch.is_ascii_hexdigit())
}

#[tauri::command]
pub async fn coach_aoc_fetch(year: u32, day: u32, input: bool, cookie: String) -> Result<HttpOut, String> {
    let url = aoc_url(year, day, input)?;
    if !cookie_ok(&cookie) {
        return Err("session cookie should be the hex value of the `session` cookie".into());
    }
    let res = client(30, false)?
        .get(url)
        .header(USER_AGENT, UA)
        .header(COOKIE, format!("session={cookie}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    read(res, 4_000_000).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn urls_and_cookie() {
        assert_eq!(aoc_url(2023, 5, true).unwrap(), "https://adventofcode.com/2023/day/5/input");
        assert_eq!(aoc_url(2023, 5, false).unwrap(), "https://adventofcode.com/2023/day/5");
        assert!(aoc_url(2014, 1, false).is_err() && aoc_url(2023, 26, false).is_err());
        assert!(cookie_ok(&"ab12".repeat(16)));
        assert!(!cookie_ok("abc; Path=/") && !cookie_ok("short"));
    }
}

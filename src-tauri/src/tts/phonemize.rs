//! Phonemization via the `espeak-ng` CLI. Mirrors the phonemizer npm package
//! (which kokoro-js uses) — which itself shells out to espeak-ng — so the
//! phoneme output matches the browser build character-for-character.
//!
//! In the packaged Tauri app, `lib.rs`'s setup() points these env vars at
//! the bundled binary + data + dylib inside the app's Resources dir. In dev
//! (`cargo test`, `tauri:dev` without prior `bundle:espeak`) the env vars
//! are unset and we fall back to `espeak-ng` on PATH — `brew install
//! espeak-ng` covers macOS dev.

use fancy_regex::Regex;
use once_cell::sync::Lazy;
use std::path::PathBuf;
use std::process::Command;

use super::TtsError;

/// If the app was launched via Tauri with a bundled espeak-ng, `lib.rs`'s
/// setup() populates these env vars with paths inside the resource dir. In
/// dev / cargo test we fall back to `espeak-ng` on PATH and let it pick up
/// its data via its own compiled-in search path.
const ENV_BIN: &str = "KHERU_ESPEAK_BIN";
const ENV_DATA: &str = "KHERU_ESPEAK_DATA";
const ENV_DYLD: &str = "KHERU_ESPEAK_DYLD";

/// Kokoro post-processing pass, ported verbatim from kokoro-js's `phonemize`
/// function (after the espeak-ng call, before tokenization). Kokoro's regexes
/// use look-around, so we use `fancy-regex` (the standard `regex` crate
/// refuses look-ahead/look-behind for its linear-time guarantee).
static POST_KOKORO: Lazy<Regex> = Lazy::new(|| Regex::new(r"kəkˈoːɹoʊ").unwrap());
static POST_KOKORO_GB: Lazy<Regex> = Lazy::new(|| Regex::new(r"kəkˈɔːɹəʊ").unwrap());
static POST_HUNDRED: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?<=[a-zɹː])(?=hˈʌndɹɪd)").unwrap());
static POST_Z_TRAIL: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#" z(?=[;:,.!?¡¿—…"«»“” ]|$)"#).unwrap());
static POST_NINETY: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?<=nˈaɪn)ti(?!ː)").unwrap());

/// Map a Kokoro voice ID's first character to the espeak-ng voice code.
/// Mirrors kokoro-js's `phonemize(text, voice.at(0))` → `"a" → "en-us"`.
pub fn voice_to_espeak_lang(voice_id: &str) -> &'static str {
    match voice_id.chars().next().unwrap_or('a') {
        'a' => "en-us",
        'b' => "en-gb",
        _ => "en", // fall back; other prefixes ('e', 'f', 'h', 'i', 'j', 'p', 'z') would need real mappings
    }
}

/// Resolve which espeak-ng binary to invoke. Prefers the bundled one when
/// running inside the packaged Tauri app; falls back to `espeak-ng` on PATH
/// for dev / `cargo test`.
fn espeak_binary() -> PathBuf {
    if let Ok(bin) = std::env::var(ENV_BIN) {
        return PathBuf::from(bin);
    }
    PathBuf::from("espeak-ng")
}

/// Turn arbitrary text into a Kokoro-compatible phoneme string.
pub fn phonemize(text: &str, voice_id: &str) -> Result<String, TtsError> {
    let lang = voice_to_espeak_lang(voice_id);

    let mut cmd = Command::new(espeak_binary());
    cmd.args(["-q", "--ipa=3", "-v", lang, text]);

    // When we're pointed at a bundled espeak-ng, it needs to find its data
    // dir + shared library. Set both env vars for the child process only.
    if let Ok(data) = std::env::var(ENV_DATA) {
        cmd.env("ESPEAK_DATA_PATH", data);
    }
    if let Ok(dyld) = std::env::var(ENV_DYLD) {
        #[cfg(target_os = "macos")]
        cmd.env("DYLD_LIBRARY_PATH", dyld);
        #[cfg(target_os = "linux")]
        cmd.env("LD_LIBRARY_PATH", dyld);
    }

    let output = cmd
        .output()
        .map_err(|e| TtsError::Load(format!("spawn espeak-ng: {e}")))?;

    if !output.status.success() {
        return Err(TtsError::Load(format!(
            "espeak-ng exited {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    // espeak-ng emits IPA one word per line separated by newlines, with a
    // trailing newline. Collapse to single spaces to match phonemizer npm.
    let raw = String::from_utf8_lossy(&output.stdout);
    let joined = raw.split_whitespace().collect::<Vec<_>>().join(" ");

    Ok(post_process(&joined, lang))
}

/// Kokoro's phoneme post-processing chain — see kokoro-js source. `fancy-regex`'s
/// `replace_all` returns a `Cow<'_, str>` so each pass gets owned.
fn post_process(input: &str, lang: &str) -> String {
    let mut s = input.to_string();
    s = POST_KOKORO.replace_all(&s, "kˈoʊkəɹoʊ").into_owned();
    s = POST_KOKORO_GB.replace_all(&s, "kˈəʊkəɹəʊ").into_owned();
    s = s.replace('ʲ', "j");
    s = s.replace('r', "ɹ");
    s = s.replace('x', "k");
    s = s.replace('ɬ', "l");
    // Look-around regexes produce zero-width matches; the replacement string
    // is the literal text to insert at the anchor.
    s = POST_HUNDRED.replace_all(&s, " ").into_owned();
    s = POST_Z_TRAIL.replace_all(&s, "z").into_owned();
    if lang == "en-us" {
        s = POST_NINETY.replace_all(&s, "di").into_owned();
    }
    s.trim().to_string()
}

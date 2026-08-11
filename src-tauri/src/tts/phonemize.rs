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

/// Punctuation-split regex, based on kokoro-js's `u` regex (see
/// `node_modules/kokoro-js/dist/kokoro.js` line 1). Splits input into
/// runs of punctuation vs runs of non-punctuation. Kokoro-js phonemizes
/// only the non-punctuation chunks and glues the punctuation back
/// verbatim — Kokoro's char-level tokenizer treats `,`, `.`, `;`, `!`,
/// `?` etc. as prosodic pause markers, so preserving them is what makes
/// speech sound paced instead of rushed.
///
/// Deliberate divergence from kokoro-js: we DO NOT split on the apostrophe.
/// Kokoro-js's regex includes `'`, which causes contractions like `I've` /
/// `Don't` / `we're` to fragment into `I` + `'` + `ve`, each phonemized as
/// a bare letter name → sounds like "Aye - Vee" instead of "I've". That's
/// a bug in kokoro-js (Docker inherits it too). We take the correct
/// behavior here even though it means the phoneme string won't be
/// byte-identical to Docker's for text containing contractions.
static PUNCT_SPLIT: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(\s*[;:,.!?¡¿—…"«»“”(){}\[\]]+\s*)+"#).unwrap()
});

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
///
/// Mirrors kokoro-js's `m` function: splits input on punctuation runs,
/// phonemizes only the non-punctuation chunks through espeak-ng, and
/// glues the punctuation back verbatim. This matters because Kokoro's
/// char-level tokenizer treats punctuation as prosody markers — if we
/// send the whole text as one espeak-ng call, punctuation gets stripped
/// during our whitespace normalization and the model produces speech
/// with no pauses (sounds rushed/faster than the Docker/web build).
pub fn phonemize(text: &str, voice_id: &str) -> Result<String, TtsError> {
    let lang = voice_to_espeak_lang(voice_id);

    let mut out = String::with_capacity(text.len() * 2);
    let mut cursor = 0usize;
    for cap in PUNCT_SPLIT.captures_iter(text).flatten() {
        let m = cap.get(0).unwrap();
        // Phonemize the non-punctuation chunk before this punctuation run.
        if m.start() > cursor {
            let chunk = &text[cursor..m.start()];
            if !chunk.trim().is_empty() {
                out.push_str(&espeak_chunk(chunk, lang)?);
            }
        }
        // Preserve the punctuation run verbatim so it reaches the tokenizer.
        out.push_str(m.as_str());
        cursor = m.end();
    }
    // Trailing non-punctuation chunk.
    if cursor < text.len() {
        let chunk = &text[cursor..];
        if !chunk.trim().is_empty() {
            out.push_str(&espeak_chunk(chunk, lang)?);
        }
    }

    Ok(post_process(&out, lang))
}

/// Spawn espeak-ng once for a single non-punctuation chunk. Extracted from
/// `phonemize` so the split-on-punctuation loop can call it per chunk.
fn espeak_chunk(text: &str, lang: &str) -> Result<String, TtsError> {
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

    // espeak-ng emits IPA one word per line separated by newlines. Collapse
    // whitespace to single spaces so glued chunks join cleanly around the
    // preserved punctuation from `phonemize`.
    let raw = String::from_utf8_lossy(&output.stdout);
    let joined = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    Ok(joined)
}

/// Kokoro's phoneme post-processing chain — see kokoro-js source. `fancy-regex`'s
/// `replace_all` returns a `Cow<'_, str>` so each pass gets owned.
fn post_process(input: &str, lang: &str) -> String {
    // Strip U+200D (zero-width joiner / tie bar). espeak-ng `--ipa=3` inserts
    // it inside diphthongs like `nˈa‍ɪn`; the phonemizer-WASM build kokoro-js
    // uses doesn't produce it. The tie is invisible to the char-level
    // tokenizer either way (not in vocab), but keeping it around breaks
    // constant-width look-behinds like `POST_NINETY` that expect `nˈaɪn`.
    let mut s: String = input.chars().filter(|&c| c != '\u{200D}').collect();
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

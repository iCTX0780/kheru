//! Regression test pinning phoneme output to what kokoro-js produces for the
//! same input. If either the punctuation-split logic in `phonemize` or one
//! of the post-processing regexes drifts, these assertions fail.
//!
//! The expected strings here were captured from
//! `scripts/dump-kokoro-js-phonemes.mjs` — the same normalize + phonemize
//! chain kokoro-js applies in the Docker/web build. Re-generate by running
//! that script if kokoro-js is upgraded and its output shifts intentionally.
//!
//! Requires `espeak-ng` on PATH (dev machines: `brew install espeak-ng`).

use kheru_lib::tts::{normalize, phonemize};

fn phonemize_us(text: &str) -> String {
    let normalized = normalize::normalize(text);
    phonemize::phonemize(&normalized, "af_bella").expect("phonemize")
}

/// Straight text — commas and periods must survive to the tokenizer as
/// prosody markers, otherwise the Kokoro model produces speech with no
/// pauses (this is what made Tauri sound "faster" than Docker).
#[test]
fn punctuation_is_preserved() {
    assert_eq!(phonemize_us("Hello, world."), "həlˈoʊ, wˈɜːld.");
    assert_eq!(
        phonemize_us("The quick brown fox jumps over the lazy dog."),
        "ðə kwˈɪk bɹˈaʊn fˈɑːks dʒˈʌmps ˌoʊvɚ ðə lˈeɪzi dˈɑːɡ.",
    );
}

/// Kokoro was trained on "ninety" → "ninedi" (post-process rule). The regex
/// depends on the tie-bar stripping in `post_process` — if that stripping
/// gets removed, POST_NINETY silently stops matching.
#[test]
fn ninety_post_process_fires() {
    let out = phonemize_us("On May 5, 1990, at 3:15 PM, the temperature was 72.5 degrees.");
    assert!(
        out.contains("nˈaɪntiːn nˈaɪndi"),
        "expected 'nineteen ninedi' from 1990, got: {out}",
    );
    // Full expected string — belt-and-suspenders.
    assert_eq!(
        out,
        "ˌɔn mˈeɪ fˈaɪv, nˈaɪntiːn nˈaɪndi, æt θɹˈiː fˈɪftiːn pˌiːˈɛm, ðə tˈɛmpɹɪtʃɚ wʌz sˈɛvənti tˈuː pˈɔɪnt fˈaɪv dᵻɡɹˈiːz.",
    );
}

/// Currency normalization (in `normalize.rs`) → dollars-and-cents form,
/// then espeak-ng phonemization → matches kokoro-js exactly.
#[test]
fn currency_and_year_pass_through() {
    assert_eq!(
        phonemize_us("This costs $1,234.56 but the sale price is $999."),
        "ðɪs kˈɔsts wˈʌn θˈaʊzənd tˈuː hˈʌndɹɪd θˈɜːɾi fˈɔːɹ dˈɑːlɚz ænd fˈɪfti sˈɪks sˈɛnts bˌʌt ðə sˈeɪl pɹˈaɪs ɪz nˈaɪn hˈʌndɹɪd nˈaɪndi nˈaɪn dˈɑːlɚz.",
    );
}

/// Contractions must phonemize as single words, not split on the apostrophe
/// into letter names. Kokoro-js splits on `'` (which turns "I've" into
/// `ˈaɪ'vˈiː` = "Aye-Vee") — that's a kokoro-js bug we deliberately
/// diverge from. Users hear "I've" not "I - V".
#[test]
fn contractions_stay_whole() {
    assert_eq!(phonemize_us("I've been thinking."), "aɪv bˌɪn θˈɪŋkɪŋ.");
    assert!(
        !phonemize_us("Don't do that.").contains("dˈɑːn'"),
        "'Don't' should not split into letters around the apostrophe",
    );
    assert!(
        !phonemize_us("We're going.").contains("wˈiː'"),
        "'We're' should not split into letters around the apostrophe",
    );
}

/// Kokoro-trained POS-aware stress: "Object" (noun) has initial stress,
/// "object" (verb) has second-syllable stress. Kokoro-js gets this via
/// how phonemizer processes each word — our per-chunk phonemization
/// through espeak-ng inherits the same behavior.
#[test]
fn heteronym_stress_shifts() {
    let out = phonemize_us(
        "Object as a noun means a thing; to object as a verb means to protest.",
    );
    // Noun form: initial stress on "Object".
    assert!(out.contains("ˈɑːbdʒɛkt"), "expected initial-stress noun form: {out}");
    // Verb form: second-syllable stress on "object".
    assert!(out.contains("ɑːbdʒˈɛkt"), "expected second-syllable-stress verb form: {out}");
}

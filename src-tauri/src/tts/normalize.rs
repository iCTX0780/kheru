//! Pre-espeak text normalization, ported verbatim from kokoro-js's `normalize`
//! function (see `node_modules/kokoro-js/dist/kokoro.js`, the `m` async
//! function). Normalizes quotes, punctuation, abbreviations, numbers,
//! currency, years, times, and decimals into forms that phonemize cleanly.
//!
//! Kokoro's regexes use look-around, so we use `fancy-regex` (the standard
//! `regex` crate refuses look-ahead/look-behind for its linear-time guarantee).

use fancy_regex::{Captures, Regex};
use once_cell::sync::Lazy;

// Order matters — the chain below runs left-to-right, matching the JS source.

static SMART_SINGLE_QUOTE: Lazy<Regex> = Lazy::new(|| Regex::new(r"[\u{2018}\u{2019}`]").unwrap());
static LAQUO: Lazy<Regex> = Lazy::new(|| Regex::new(r"«").unwrap());
static RAQUO: Lazy<Regex> = Lazy::new(|| Regex::new(r"»").unwrap());
static SMART_DOUBLE_QUOTE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"[\u{201C}\u{201D}]").unwrap());
static LPAREN: Lazy<Regex> = Lazy::new(|| Regex::new(r"\(").unwrap());
static RPAREN: Lazy<Regex> = Lazy::new(|| Regex::new(r"\)").unwrap());

// CJK punctuation → ASCII + trailing space.
static CJK_COMMA_IDEO: Lazy<Regex> = Lazy::new(|| Regex::new(r"、").unwrap());
static CJK_PERIOD: Lazy<Regex> = Lazy::new(|| Regex::new(r"。").unwrap());
static CJK_BANG: Lazy<Regex> = Lazy::new(|| Regex::new(r"！").unwrap());
static CJK_COMMA_FW: Lazy<Regex> = Lazy::new(|| Regex::new(r"，").unwrap());
static CJK_COLON: Lazy<Regex> = Lazy::new(|| Regex::new(r"：").unwrap());
static CJK_SEMI: Lazy<Regex> = Lazy::new(|| Regex::new(r"；").unwrap());
static CJK_QUEST: Lazy<Regex> = Lazy::new(|| Regex::new(r"？").unwrap());

// Whitespace normalization. `[^\S \n]` = any WS char that isn't a space or
// newline (tabs, CR, form feed, vertical tab, non-breaking space, etc.).
static WS_EXCEPT_SPACE_NEWLINE: Lazy<Regex> = Lazy::new(|| Regex::new(r"[^\S \n]").unwrap());
static COLLAPSE_SPACES: Lazy<Regex> = Lazy::new(|| Regex::new(r"  +").unwrap());
static BLANK_LINE_SPACES: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?<=\n) +(?=\n)").unwrap());

// Abbreviations.
static DR: Lazy<Regex> = Lazy::new(|| Regex::new(r"\bD[Rr]\.(?= [A-Z])").unwrap());
static MR: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b(?:Mr\.|MR\.(?= [A-Z]))").unwrap());
static MS: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b(?:Ms\.|MS\.(?= [A-Z]))").unwrap());
static MRS: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b(?:Mrs\.|MRS\.(?= [A-Z]))").unwrap());
static ETC: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\betc\.(?! [A-Z])").unwrap());
static YEAH: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\b(y)eah?\b").unwrap());

// Time / year / decimal detector.
static TIME_YEAR_DECIMAL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)").unwrap()
});

// Comma between digits → strip.
static COMMA_IN_NUMBER: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?<=\d),(?=\d)").unwrap());

// Currency.
static CURRENCY: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b",
    )
    .unwrap()
});

// Decimal expansion (final pass — the time/year/decimal detector already
// short-circuits for decimals, leaving them for us).
static DECIMAL: Lazy<Regex> = Lazy::new(|| Regex::new(r"\d*\.\d+").unwrap());

// Range: digit-digit → digit to digit.
static RANGE_DASH: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?<=\d)-(?=\d)").unwrap());

// Number followed by S → space before S (plural years like "1990S").
static DIGIT_S: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?<=\d)S").unwrap());

// Consonant-cluster's → 'S (all-caps letter runs like "NASA's" → "NASA'S").
static CONSONANT_S: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?<=[BCDFGHJ-NP-TV-Z])'?s\b").unwrap());

// Exception: X'S → X's.
static XS_EXCEPTION: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?<=X')S\b").unwrap());

// Initials like "F.B.I. a" → "F-B-I- a".
static INITIALS_RUN: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?:[A-Za-z]\.){2,} [a-z]").unwrap());
static DOT_IN_RUN: Lazy<Regex> = Lazy::new(|| Regex::new(r"\.").unwrap());

// Single initial letters "A." → "A-".
static SINGLE_INITIAL: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)(?<=[A-Z])\.(?=[A-Z])").unwrap());

/// Turn arbitrary text into a Kokoro-friendly form ready for espeak-ng.
/// Runs kokoro-js's normalization chain in order — the order matters (e.g.
/// the comma-in-number strip must run AFTER the time/year/decimal pass, else
/// it would break `1,000` before the year detector can see it).
pub fn normalize(text: &str) -> String {
    let mut s = text.to_string();

    s = SMART_SINGLE_QUOTE.replace_all(&s, "'").into_owned();
    s = LAQUO.replace_all(&s, "\u{201C}").into_owned();
    s = RAQUO.replace_all(&s, "\u{201D}").into_owned();
    s = SMART_DOUBLE_QUOTE.replace_all(&s, "\"").into_owned();
    s = LPAREN.replace_all(&s, "«").into_owned();
    s = RPAREN.replace_all(&s, "»").into_owned();

    s = CJK_COMMA_IDEO.replace_all(&s, ", ").into_owned();
    s = CJK_PERIOD.replace_all(&s, ". ").into_owned();
    s = CJK_BANG.replace_all(&s, "! ").into_owned();
    s = CJK_COMMA_FW.replace_all(&s, ", ").into_owned();
    s = CJK_COLON.replace_all(&s, ": ").into_owned();
    s = CJK_SEMI.replace_all(&s, "; ").into_owned();
    s = CJK_QUEST.replace_all(&s, "? ").into_owned();

    s = WS_EXCEPT_SPACE_NEWLINE.replace_all(&s, " ").into_owned();
    // NOTE: the JS source's `.replace(/  +/, " ")` is deliberately NOT `/g` —
    // it only collapses the first run. Ported faithfully via `replace` (single).
    s = COLLAPSE_SPACES.replace(&s, " ").into_owned();
    s = BLANK_LINE_SPACES.replace_all(&s, "").into_owned();

    s = DR.replace_all(&s, "Doctor").into_owned();
    s = MR.replace_all(&s, "Mister").into_owned();
    s = MS.replace_all(&s, "Miss").into_owned();
    s = MRS.replace_all(&s, "Mrs").into_owned();
    s = ETC.replace_all(&s, "etc").into_owned();
    s = YEAH.replace_all(&s, "${1}e'a").into_owned();

    s = replace_all_with(&TIME_YEAR_DECIMAL, &s, time_year_decimal);

    s = COMMA_IN_NUMBER.replace_all(&s, "").into_owned();

    s = replace_all_with(&CURRENCY, &s, currency);
    s = replace_all_with(&DECIMAL, &s, decimal);

    s = RANGE_DASH.replace_all(&s, " to ").into_owned();
    s = DIGIT_S.replace_all(&s, " S").into_owned();
    s = CONSONANT_S.replace_all(&s, "'S").into_owned();
    s = XS_EXCEPTION.replace_all(&s, "s").into_owned();

    s = replace_all_with(&INITIALS_RUN, &s, |m| {
        DOT_IN_RUN.replace_all(m, "-").into_owned()
    });
    s = SINGLE_INITIAL.replace_all(&s, "-").into_owned();

    s.trim().to_string()
}

/// `fancy_regex`'s replace API doesn't take a closure the way `regex` does, so
/// we roll a small helper that walks matches and lets the caller compute each
/// replacement from the matched slice.
fn replace_all_with<F>(re: &Regex, input: &str, mut f: F) -> String
where
    F: FnMut(&str) -> String,
{
    let mut out = String::with_capacity(input.len());
    let mut last = 0usize;
    for cap in re.captures_iter(input).flatten() {
        // Whole-match group is always index 0.
        let m = cap.get(0).unwrap();
        out.push_str(&input[last..m.start()]);
        out.push_str(&f(m.as_str()));
        last = m.end();
    }
    out.push_str(&input[last..]);
    out
}

// Silences an unused-import warning if `Captures` becomes unused after edits.
#[allow(dead_code)]
fn _touch_captures(_c: Captures) {}

/// Port of kokoro-js helper `o` — resolves whether the match is a decimal
/// (deferred), a clock time, or a 4-digit year (with optional trailing `s`).
fn time_year_decimal(e: &str) -> String {
    if e.contains('.') {
        return e.to_string();
    }
    if e.contains(':') {
        let mut parts = e.split(':');
        let h: u32 = parts.next().unwrap_or("0").parse().unwrap_or(0);
        let m: u32 = parts.next().unwrap_or("0").parse().unwrap_or(0);
        if m == 0 {
            return format!("{h} o'clock");
        }
        if m < 10 {
            return format!("{h} oh {m}");
        }
        return format!("{h} {m}");
    }

    // 4-digit year, optionally with trailing 's'.
    let year: u32 = e[..4].parse().unwrap_or(0);
    if year < 1100 || year % 1000 < 10 {
        return e.to_string();
    }
    let century = &e[..2];
    let rest: u32 = e[2..4].parse().unwrap_or(0);
    let s = if e.ends_with('s') { "s" } else { "" };
    let tail = year % 1000;
    if (100..=999).contains(&tail) {
        if rest == 0 {
            return format!("{century} hundred{s}");
        }
        if rest < 10 {
            return format!("{century} oh {rest}{s}");
        }
    }
    format!("{century} {rest}{s}")
}

/// Port of kokoro-js helper `c` — expands `$5`, `£1.50`, `$5 hundred`, etc.
fn currency(e: &str) -> String {
    let first = e.chars().next().unwrap_or('$');
    let unit = if first == '$' { "dollar" } else { "pound" };
    let body = &e[1..]; // ASCII `$`/`£`? — `£` is 2 bytes in UTF-8, so guard.
    let body = if first == '£' { &e[2..] } else { body };

    // `$5 hundred` style: rest doesn't parse as a bare number.
    if body.parse::<f64>().is_err() {
        return format!("{body} {unit}s");
    }
    if !body.contains('.') {
        let s = if body == "1" { "" } else { "s" };
        return format!("{body} {unit}{s}");
    }
    let mut parts = body.splitn(2, '.');
    let d = parts.next().unwrap_or("0");
    let c = parts.next().unwrap_or("0");
    // Pad to 2 digits for cents parsing.
    let c_padded = format!("{c:0<2}");
    let c_padded = &c_padded[..2];
    let cents: u32 = c_padded.parse().unwrap_or(0);
    let dollar_suffix = if d == "1" { "" } else { "s" };
    let cent_word = if first == '$' {
        if cents == 1 { "cent" } else { "cents" }
    } else if cents == 1 {
        "penny"
    } else {
        "pence"
    };
    format!("{d} {unit}{dollar_suffix} and {cents} {cent_word}")
}

/// Port of kokoro-js helper `g` — reads `3.14` as `3 point 1 4`.
fn decimal(e: &str) -> String {
    let mut parts = e.splitn(2, '.');
    let int_part = parts.next().unwrap_or("");
    let frac_part = parts.next().unwrap_or("");
    let spaced: String = frac_part
        .chars()
        .map(|c| c.to_string())
        .collect::<Vec<_>>()
        .join(" ");
    format!("{int_part} point {spaced}")
}

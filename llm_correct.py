import json
import re
import os
import ollama

SLICED_TXT = os.path.join("output", "sliced.txt")
GLOBAL_TXT = os.path.join("output", "global_ocr.txt")
GLOBAL_TXT_ALIAS = os.path.join("output", "global.txt")
LLM_CORRECT_TXT = os.path.join("output", "llm_correct.txt")
OUTPUT_JSON = os.path.join("output", "corrected.json")

# ── helpers ──────────────────────────────────────────────────────────────────

def parse_numeric_value(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace(',', '').strip()
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def dynamic_math_audit(product_list):
    """Flag / fix Qty*Rate mismatches in any product list."""
    audited = []
    for item in product_list:
        try:
            qty     = float(re.sub(r'[^\d.]', '', str(item.get('Quantity', item.get('Qty', 0)))))
            rate    = float(re.sub(r'[^\d.]', '', str(item.get('Rate', 0))))
            claimed = float(re.sub(r'[^\d.]', '', str(item.get('Amount', 0))))
            actual  = round(qty * rate, 2)
            if abs(actual - claimed) > (actual * 0.05):
                item['Validation_Warning'] = f"OCR says {claimed}, math (Qty*Rate) suggests {actual}"
                item['Amount'] = actual
        except Exception:
            pass
        audited.append(item)
    return audited


def validate_json_data(data):
    """Warn about remaining math mismatches."""
    for item in data.get('Products', []):
        try:
            qty         = parse_numeric_value(item.get('Qty', 0))
            rate        = parse_numeric_value(item.get('Rate', 0))
            claimed_amt = parse_numeric_value(item.get('Amount', 0))
            if qty is None or rate is None or claimed_amt is None:
                continue
            expected  = qty * rate
            tolerance = abs(expected) * 0.01
            if abs(expected - claimed_amt) > tolerance:
                item['ValidationWarning'] = f"Expected {expected:.2f}, invoice says {claimed_amt:.2f}"
        except (TypeError, ValueError, KeyError):
            continue
    return data


# ── GSTIN correction ─────────────────────────────────────────────────────────
# Indian GSTIN format (15 characters):
#   [1-2]  : 2-digit state code  (e.g. 33 = Tamil Nadu)
#   [3-7]  : 5 PAN letters (A-Z)
#   [8-11] : 4 PAN digits
#   [12]   : PAN check letter (A-Z)
#   [13]   : entity number digit (1-9)
#   [14]   : ALWAYS the letter Z
#   [15]   : checksum alphanumeric
GSTIN_RE = re.compile(r'^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$')

# Characters that look like digits but are letters (and vice-versa)
_DIGIT_MAP = {'S': '3', 'O': '0', 'I': '1', 'B': '8', 'G': '6', 'Z': '2'}
_ALPHA_MAP = {'0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G'}

# In state code: S looks like 3 more than 5 when beside another 3
_STATE_S_TO_3  = str.maketrans('SOIBGZ', '301862')
_PAN_ALPHA_FIX = str.maketrans('051862', 'OSIBGZ')   # digit → letter
_PAN_DIGIT_FIX = str.maketrans('SOIBGZ', '301862')   # letter → digit


def correct_gstin_python(raw: str, force_state_code: str = '') -> str:
    """
    Positional rule-based GSTIN correction.
    All OCR confusion is resolved per character class expected at each position.
    Does NOT rearrange or guess digits — only swaps visually-similar chars.
    """
    g = re.sub(r'[^A-Z0-9]', '', raw.upper())   # strip spaces / punctuation
    if not g:
        return raw

    # --- position 14 (index 13) fix: insert Z if clearly missing ---
    # If 14 chars and position 12 (index 12) is Z, it slipped one left → insert '1' before it
    if len(g) == 14 and g[12] in ('Z', '2'):
        g = g[:12] + '1' + g[12:]

    if len(g) != 15:
        return g   # can't safely fix non-15-char strings

    g = list(g)

    # [0-1] State code → must be digits
    # Special: if first digit is '3' and second is 'S', it's almost certainly '33'
    if g[0] == '3' and g[1] == 'S':
        g[1] = '3'
    else:
        for i in (0, 1):
            g[i] = _DIGIT_MAP.get(g[i], g[i])

    if force_state_code and re.fullmatch(r'\d{2}', force_state_code):
        g[0], g[1] = force_state_code[0], force_state_code[1]

    # [2-6] PAN letters → must be alpha
    for i in range(2, 7):
        g[i] = _ALPHA_MAP.get(g[i], g[i])

    # [7-10] PAN digits → must be numeric
    # Note: '0' vs '2' confusion cannot be resolved here without external data
    for i in range(7, 11):
        g[i] = _DIGIT_MAP.get(g[i], g[i])

    # [11] PAN check letter → must be alpha
    g[11] = _ALPHA_MAP.get(g[11], g[11])

    # [12] Entity number → must be digit 1-9
    entity_fix = {'O': '0', 'I': '1', 'L': '1', 'Z': '1', 'S': '5', 'B': '8', 'G': '6'}
    g[12] = entity_fix.get(g[12], g[12])

    # [13] ALWAYS 'Z'  — fix any visually-similar character
    if g[13] != 'Z':
        g[13] = 'Z'

    # [14] Checksum — alphanumeric, leave as-is
    return ''.join(g)


def validate_gstin(gstin: str) -> dict:
    """Return a dict with 'valid' flag and 'issues' list."""
    if not gstin:
        return {'valid': False, 'issues': ['GSTIN is empty']}
    g = gstin.strip().upper()
    issues = []
    if len(g) != 15:
        issues.append(f"Length is {len(g)}, expected 15")
    elif not GSTIN_RE.match(g):
        # Report first failing positional rule
        if not g[:2].isdigit():
            issues.append(f"State code '{g[:2]}' is not numeric")
        if g[13] != 'Z':
            issues.append(f"Position 14 is '{g[13]}', expected 'Z'")
        if not issues:
            issues.append("Does not match GSTIN pattern")
    return {'valid': len(issues) == 0, 'issues': issues}


def fix_gstins_in_data(data: dict) -> dict:
    """
    For every *_GSTIN key that holds a plain string value:
    1. Apply positional correction (letter/digit class swaps)
    2. Validate the result and attach a warning if still invalid
    Skips keys whose value is a list or dict (e.g. 'GSTIN Correction' logs).
    """
    gstin_keys = [
        k for k in data
        if ('gstin' in k.lower() or k.upper().endswith('_GST'))
        and isinstance(data[k], str)
        and 'warning' not in k.lower()
    ]
    for key in gstin_keys:
        raw = data[key].strip().upper()
        if not raw:
            continue
        corrected = correct_gstin_python(raw, force_state_code='33')
        if corrected != raw:
            print(f"  [GSTIN FIX] {key}: '{raw}' → '{corrected}'")
            data[f"{key}_OCR_Raw"] = raw
            data[key] = corrected
        result = validate_gstin(corrected)
        if not result['valid']:
            data[f"{key}_ValidationWarning"] = '; '.join(result['issues'])
            print(f"  [GSTIN WARNING] {key} still has issues: {'; '.join(result['issues'])}")
        else:
            print(f"  [GSTIN OK] {key}: {corrected}")
    return data

# Fields that must be present and non-empty for the sliced result to be considered complete
REQUIRED_FIELDS = ['Invoice_Date', 'Invoice_No', 'Seller', 'Buyer', 'Seller_GSTIN', 'Buyer_GSTIN']


def missing_fields(data: dict) -> list:
    """Return list of REQUIRED_FIELDS that are absent or blank in data."""
    return [f for f in REQUIRED_FIELDS if not str(data.get(f, '')).strip()]


def call_llm(prompt_text: str, system: str) -> str:
    response = ollama.generate(
        model='qwen2.5:7b',
        system=system,
        prompt=prompt_text,
        format='json',
        options={'temperature': 0}
    )
    return response['response']


def normalize_ocr_text(text: str) -> str:
    """Normalize OCR text spacing while preserving original content."""
    if not text:
        return ""

    normalized_lines = []
    for raw_line in str(text).replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw_line.strip()
        if not line:
            if normalized_lines and normalized_lines[-1] != "":
                normalized_lines.append("")
            continue

        line = re.sub(r'\s+', ' ', line)
        line = re.sub(r'\s+([,.;:])', r'\1', line)
        if "GSTIN" in line.upper():
            line = re.sub(
                r'(GSTIN\s*[:\-]?\s*)([A-Z0-9 ]{8,})',
                lambda m: m.group(1) + re.sub(r'\s+', '', m.group(2).upper()),
                line,
                flags=re.IGNORECASE
            )
        normalized_lines.append(line)

    return "\n".join(normalized_lines).strip()


def read_and_clean_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        content = normalize_ocr_text(f.read())
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return content


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    if not os.path.exists(SLICED_TXT):
        print(f"ERROR: {SLICED_TXT} not found.")
        return

    sliced_content = read_and_clean_file(SLICED_TXT)

    if not sliced_content.strip():
        print("ERROR: sliced.txt is empty.")
        return

    # Prefer global.txt explicitly for fallback enrichment.
    global_txt_path = GLOBAL_TXT_ALIAS if os.path.exists(GLOBAL_TXT_ALIAS) else GLOBAL_TXT
    global_content = ""
    if os.path.exists(global_txt_path):
        global_content = read_and_clean_file(global_txt_path)

    # Keep both names in sync when either one exists.
    if global_content:
        with open(GLOBAL_TXT, "w", encoding="utf-8") as f:
            f.write(global_content)
        with open(GLOBAL_TXT_ALIAS, "w", encoding="utf-8") as f:
            f.write(global_content)

    # Keep a trace file of the exact OCR context used for LLM correction.
    with open(LLM_CORRECT_TXT, "w", encoding="utf-8") as f:
        f.write("SLICED OCR:\n")
        f.write(sliced_content)
        f.write("\n\n")
        if global_content.strip():
            f.write("GLOBAL OCR FALLBACK:\n")
            f.write(global_content)
            f.write("\n")

    base_system = (
        "You are an expert Invoice Parser.\n"
        "RULES:\n"
        "1. MATH: Calculate Qty * Rate. Trust the math and 'Rupees in words' over raw OCR numbers if they conflict.\n"
        "2. GST: Copy the GSTIN string EXACTLY as it appears in the OCR text. Do NOT rearrange, reconstruct, or guess characters.\n"
        "   Post-processing code will fix character-class errors (e.g. S<->3, O<->0, Z at position 14).\n"
        "3. STRUCTURE: Extract Seller, Buyer, Seller_GSTIN, Buyer_GSTIN, Invoice_No, Invoice_Date, Bank Details, and Table Rows.\n"
        "4. DATE: Look for dates near the Invoice Number. Output as Invoice_Date in DD/MM/YYYY format or as found.\n"
        "5. PUNCTUATION: When OCR uses '.' as a thousands separator in amount-like values (example: 28.041), normalize it to ',' (28,041). Keep true decimal values unchanged.\n"
        "RETURN ONLY JSON."
    )

    # ── Pass 1: use cleaned sliced + global OCR if available ─────────────────
    print(f"[Pass 1] Sending cleaned OCR text from {SLICED_TXT} to LLM …")
    print(f"[INFO] LLM correction context saved to {LLM_CORRECT_TXT}")
    try:
        pass1_prompt = f"PROCESS THIS INVOICE OCR TEXT (slice-level detail):\n{sliced_content}"
        if global_content.strip():
            pass1_prompt += f"\n\nGLOBAL OCR (layout fallback):\n{global_content}"

        llm_json_str = call_llm(
            pass1_prompt,
            base_system
        )
    except Exception as e:
        print(f"LLM call failed: {e}")
        return

    print("\n=== RAW LLM JSON (Pass 1) ===")
    print(llm_json_str)

    try:
        data = json.loads(llm_json_str)
    except json.JSONDecodeError as e:
        print(f"\nWARNING: LLM returned invalid JSON ({e}). Saving raw response.")
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            f.write(llm_json_str)
        print(f"Raw response saved to {OUTPUT_JSON}")
        return

    # ── Pass 2: fill missing fields from global_ocr.txt (if needed) ──────────
    missing = missing_fields(data)
    if missing and global_content.strip():
        if global_content.strip():
            print(f"\n[Pass 2] Fields missing from slices: {missing}. Querying global.txt fallback …")
            gap_system = (
                "You are an expert Invoice Parser. "
                "The primary slice-level OCR could not extract some fields. "
                "Using the global OCR layout below, extract ONLY the following missing fields: "
                f"{', '.join(missing)}. "
                "Return a JSON object with only those keys. "
                "Copy GSTIN strings exactly as they appear — do not reconstruct them. "
                "Also normalize '.' to ',' only when it is clearly a thousands separator in amount-like values."
            )
            try:
                gap_json_str = call_llm(
                    f"GLOBAL OCR LAYOUT:\n{global_content}",
                    gap_system
                )
                print("\n=== RAW LLM JSON (Pass 2 - gap fill) ===")
                print(gap_json_str)
                gap_data = json.loads(gap_json_str)
                # Merge: only fill keys that are still blank in primary data
                for field in missing:
                    if str(gap_data.get(field, '')).strip():
                        data[field] = gap_data[field]
                        print(f"  [GAP FILL] {field}: '{gap_data[field]}'")
            except Exception as e:
                print(f"[Pass 2] LLM call or parse failed: {e} — skipping gap fill")
    elif missing:
        print(f"\n[INFO] Fields missing: {missing} — global OCR file not found, skipping gap fill.")
    else:
        print("\n[INFO] All required fields present in sliced.txt output — global OCR not needed.")

    # ── Post-processing ───────────────────────────────────────────────────────
    data['Products'] = dynamic_math_audit(data.get('Products', []))
    data = validate_json_data(data)

    print("\n=== GSTIN VALIDATION ===")
    data = fix_gstins_in_data(data)

    print("\n=== CORRECTED & VALIDATED JSON ===")
    pretty = json.dumps(data, indent=2, ensure_ascii=False)
    print(pretty)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        f.write(pretty)
    print(f"\nOutput saved to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()

import json
import re
import os
import sys
import ollama

DEFAULT_OUTPUT_DIR = "output"
DEFAULT_VALIDATED_JSON = "validated_clean.json"


def configure_paths(output_dir=DEFAULT_OUTPUT_DIR, validated_json_name=DEFAULT_VALIDATED_JSON):
    global SLICED_TXT, GLOBAL_TXT, GLOBAL_TXT_ALIAS, LLM_CORRECT_TXT, OUTPUT_JSON, VALIDATED_JSON
    SLICED_TXT = os.path.join(output_dir, "sliced.txt")
    GLOBAL_TXT = os.path.join(output_dir, "global_ocr.txt")
    GLOBAL_TXT_ALIAS = os.path.join(output_dir, "global.txt")
    LLM_CORRECT_TXT = os.path.join(output_dir, "llm_correct.txt")
    OUTPUT_JSON = os.path.join(output_dir, "corrected.json")
    VALIDATED_JSON = os.path.join(output_dir, validated_json_name)


configure_paths()

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


def parse_amount_like_value(value):
    """Parse amount-like OCR tokens, including dot-separated thousands."""
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    cleaned = re.sub(r'[^\d.,]', '', text)
    if not cleaned:
        return None

    if cleaned.count('.') > 1:
        digits = re.sub(r'\D', '', cleaned)
        return float(digits) if digits else None

    if ',' not in cleaned and re.fullmatch(r'\d{1,3}\.\d{3}', cleaned):
        return float(cleaned.replace('.', ''))

    normalized = cleaned.replace(',', '')
    try:
        return float(normalized)
    except ValueError:
        digits = re.sub(r'\D', '', normalized)
        return float(digits) if digits else None


def format_amount_for_export(value):
    parsed = parse_amount_like_value(value)
    if parsed is None:
        return ""
    if float(parsed).is_integer():
        return f"{int(parsed):,}"
    return f"{parsed:,.2f}"


_ONES = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
_TEENS = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def number_to_words(n: int) -> str:
    """Convert an integer amount to English words (Indian currency style is handled by caller)."""
    if n == 0:
        return "Zero"

    def under_thousand(num: int) -> str:
        parts = []
        hundreds, rem = divmod(num, 100)
        if hundreds:
            parts.append(f"{_ONES[hundreds]} Hundred")
        if rem:
            if rem < 10:
                parts.append(_ONES[rem])
            elif rem < 20:
                parts.append(_TEENS[rem - 10])
            else:
                tens, ones = divmod(rem, 10)
                if ones:
                    parts.append(f"{_TENS[tens]} {_ONES[ones]}")
                else:
                    parts.append(_TENS[tens])
        return " ".join(parts).strip()

    units = [(10000000, "Crore"), (100000, "Lakh"), (1000, "Thousand")]
    parts = []
    remaining = n
    for divisor, label in units:
        chunk, remaining = divmod(remaining, divisor)
        if chunk:
            parts.append(f"{number_to_words(chunk)} {label}")

    if remaining:
        parts.append(under_thousand(remaining))

    return " ".join(parts).strip()


def amount_to_rupees_words(value) -> str:
    parsed = parse_numeric_value(value)
    if parsed is None:
        return ""
    integer_part = int(round(parsed))
    return f"{number_to_words(integer_part)} Rupees Only".replace("  ", " ").strip()


def extract_bank_details(data: dict) -> dict:
    seller_bank = data.get("Bank_Details") or data.get("BankInfo") or data.get("Seller", {}).get("BankDetails") or {}
    if not isinstance(seller_bank, dict):
        seller_bank = {}

    bank_name = seller_bank.get("BankName") or seller_bank.get("Bank_Name") or seller_bank.get("Bank") or ""
    return {
        "Bank_Name": bank_name,
        "Account_Name": seller_bank.get("AccountName") or seller_bank.get("A/c_Name") or seller_bank.get("Account_Name") or data.get("Seller_Name") or data.get("Seller") or "",
        "Account_Number": seller_bank.get("AccountNumber") or seller_bank.get("A/c_No") or seller_bank.get("Account_No") or "",
        "IFSC": seller_bank.get("IFSC") or seller_bank.get("IFSCCode") or "",
        "Branch": seller_bank.get("Branch") or ""
    }


def extract_tax_details(data: dict) -> dict:
    tax = data.get("TaxDetails") if isinstance(data.get("TaxDetails"), dict) else {}
    if not isinstance(tax, dict):
        tax = {}
    return {
        "CGST": tax.get("CGST") or data.get("CGST") or "",
        "SGST": tax.get("SGST") or data.get("SGST") or "",
        "IGST": tax.get("IGST") or data.get("IGST") or ""
    }


def normalize_product_rows(data: dict) -> list:
    """Return a normalized list of product dictionaries from all supported OCR shapes."""
    source_rows = (
        data.get("Products")
        or data.get("Product_Details")
        or data.get("Table_Rows")
        or data.get("TableRows")
        or []
    )

    normalized = []
    for index, item in enumerate(source_rows, start=1):
        if not isinstance(item, dict):
            continue

        raw_s_no = str(item.get("S_No") or item.get("SNo") or item.get("S_No.") or "").strip()
        raw_name = str(item.get("Name_of_Product") or item.get("ProductName") or item.get("Name") or item.get("Item") or item.get("Description") or "").strip()
        upper_s_no = raw_s_no.upper()
        upper_name = raw_name.upper()

        # Skip summary/total rows entirely.
        if any(token in upper_s_no for token in ("TOTAL", "GRAND TOTAL", "SUB TOTAL")):
            continue
        if any(token in upper_name for token in ("TOTAL", "GRAND TOTAL", "SUB TOTAL")):
            continue

        serial_no = item.get("S_No") or item.get("SNo") or item.get("S_No.") or index
        product_name = raw_name

        # If OCR placed the product name in S_No and the second field is only a fragment,
        # prefer the richer text from S_No and use a numeric serial instead.
        if raw_s_no and not raw_s_no.isdigit():
            if not product_name or len(raw_s_no) > len(product_name) or product_name in raw_s_no:
                product_name = raw_s_no
                serial_no = index

        # Avoid blank or duplicate product names.
        if product_name and raw_s_no and product_name == raw_s_no:
            serial_no = index

        normalized.append({
            "S_No": serial_no,
            "Name_of_Product": product_name,
            "HSN_Code": item.get("HSN_Code") or item.get("HSNCode") or item.get("HSN") or "",
            "Qty": item.get("Qty") or item.get("Quantity") or item.get("QTY") or "",
            "Rate": item.get("Rate") or item.get("MRP") or item.get("Price") or "",
            "CGST_Percent": item.get("CGST_Percent") or item.get("CGST_Rate") or item.get("CGST") or "",
            "SGST_Percent": item.get("SGST_Percent") or item.get("SGST_Rate") or item.get("SGST") or "",
            "IGST_Percent": item.get("IGST_Percent") or item.get("IGST_Rate") or item.get("IGST") or "",
            "Amount": item.get("Amount") or item.get("Total") or item.get("Line_Total") or ""
        })

    return normalized


def normalize_numeric_ocr_field(value, keep_decimal=True):
    """Correct common OCR substitutions without deriving values from other fields."""
    if value is None:
        return ""

    text = str(value).strip().upper()
    if not text:
        return ""

    char_map = {
        'O': '0',
        'D': '0',
        'I': '1',
        'L': '1',
        'S': '5',
        'Z': '2',
        'G': '6',
        'B': '6',
    }
    allowed = '0123456789.,' if keep_decimal else '0123456789'
    normalized = []
    for char in text:
        mapped = char_map.get(char, char)
        if mapped in allowed:
            normalized.append(mapped)
    return ''.join(normalized)


def repair_hsn_code(value):
    """Repair common OCR substitutions in HSN values."""
    if value is None:
        return ""

    raw = re.sub(r'[^A-Z0-9]', '', str(value).upper())
    if not raw:
        return ""

    hsn_map = {'S': '5', 'O': '0', 'D': '0', 'I': '1', 'Z': '2', 'G': '6', 'B': '6', 'L': '1'}
    repaired = ''.join(hsn_map.get(char, char) for char in raw)
    if repaired.isdigit() and len(repaired) in (4, 6, 8):
        return repaired
    return repaired if repaired.isdigit() else raw


def normalize_export_date(value):
    if value is None:
        return ""

    text = str(value).strip()
    if not text:
        return ""

    text = text.replace('0024', '2024')
    match = re.search(r'(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})', text)
    if not match:
        return text

    day = int(match.group(1))
    month = int(match.group(2))
    year = match.group(3)
    if year == '24':
        year = '2024'
    elif len(year) == 2:
        year = f'20{year}'
    elif year == '0024':
        year = '2024'

    return f"{day:02d}/{month:02d}/{year}"


def clean_invoice_number(value):
    """Extract the main invoice number, removing subsidiary parts like /MM/YYYY.
    
    E.g., "153/11/2024" -> "153"
    """
    if value is None:
        return ""
    
    text = str(value).strip()
    if not text:
        return ""
    
    # If the invoice number contains a "/" (subsidiary format like 153/11/2024),
    # extract just the first part (153)
    if "/" in text:
        main_part = text.split("/")[0].strip()
        return main_part
    
    return text


def dynamic_math_audit(product_list):
    """Preserve OCR field values and apply only field-local text correction."""
    audited = []
    for item in product_list:
        if not isinstance(item, dict):
            continue
        normalized_item = dict(item)
        normalized_item['HSN_Code'] = repair_hsn_code(normalized_item.get('HSN_Code', ''))
        normalized_item['Qty'] = normalize_numeric_ocr_field(
            normalized_item.get('Quantity', normalized_item.get('Qty', ''))
        )
        normalized_item['Rate'] = normalize_numeric_ocr_field(normalized_item.get('Rate', ''))
        normalized_item['Amount'] = normalize_numeric_ocr_field(normalized_item.get('Amount', ''))
        audited.append(normalized_item)
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
            print(f"  [GSTIN FIX] {key}: '{raw}' -> '{corrected}'")
            data[f"{key}_OCR_Raw"] = raw
            data[key] = corrected
        result = validate_gstin(corrected)
        if not result['valid']:
            data[f"{key}_ValidationWarning"] = '; '.join(result['issues'])
            print(f"  [GSTIN WARNING] {key} still has issues: {'; '.join(result['issues'])}")
        else:
            print(f"  [GSTIN OK] {key}: {corrected}")
    return data


def extract_all_gstin_candidates(text: str) -> list:
    """Extract 15-char GST-like candidates from OCR text."""
    if not text:
        return []

    normalized = re.sub(r'[^A-Z0-9\n ]', ' ', str(text).upper())
    joined = normalized.replace(' ', '')

    candidates = []
    # Strict 15-char alphanumeric windows are enough for OCR GSTIN recovery.
    for i in range(0, max(0, len(joined) - 14)):
        token = joined[i:i + 15]
        if re.fullmatch(r'[A-Z0-9]{15}', token):
            candidates.append(token)

    # Keep order while removing duplicates.
    seen = set()
    unique = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    return unique


def _prefer_buyer_gstin_from_lines(text: str) -> str:
    """Prefer GSTIN near buyer/bill-to sections before generic candidates."""
    if not text:
        return ""

    lines = [ln.strip() for ln in str(text).splitlines() if ln.strip()]
    scored = []

    for idx, line in enumerate(lines):
        upper = line.upper()
        context = " ".join(lines[max(0, idx - 2): min(len(lines), idx + 3)]).upper()
        line_candidates = extract_all_gstin_candidates(line)
        if not line_candidates:
            line_candidates = extract_all_gstin_candidates(context)

        if not line_candidates:
            continue

        score = 0
        if 'BUYER' in context or 'BILL TO' in context or 'SHIP TO' in context:
            score += 4
        if 'SELLER' in context or 'SUPPLIER' in context:
            score -= 2
        if 'GST' in upper or 'GSTIN' in upper:
            score += 2

        for cand in line_candidates:
            scored.append((score, cand))

    if scored:
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    # Fallback: first generic candidate from full text
    generic = extract_all_gstin_candidates(text)
    return generic[0] if generic else ""


def ensure_buyer_gstin(data: dict, sliced_text: str, global_text: str) -> dict:
    """Guarantee Buyer_GSTIN is populated and repaired from OCR context."""
    current = str(data.get('Buyer_GSTIN', '')).strip().upper()

    # If already valid, keep as-is.
    if current and validate_gstin(current)['valid']:
        return data

    ocr_pool = "\n".join([sliced_text or "", global_text or ""])
    candidate = _prefer_buyer_gstin_from_lines(ocr_pool)
    if not candidate:
        return data

    corrected = correct_gstin_python(candidate)
    # If we still have a value from LLM, keep OCR raw trace.
    if current and current != corrected:
        data['Buyer_GSTIN_OCR_Raw'] = current
    data['Buyer_GSTIN'] = corrected

    check = validate_gstin(corrected)
    if not check['valid']:
        data['Buyer_GSTIN_ValidationWarning'] = '; '.join(check['issues'])
    elif 'Buyer_GSTIN_ValidationWarning' in data:
        del data['Buyer_GSTIN_ValidationWarning']
    return data


def final_data_repair(data):
    """Programmatic correction for HSN, Date, and Field mapping."""

    # 1. Force Year Correction (0024 -> 2024)
    if 'Invoice_Date' in data and '0024' in str(data['Invoice_Date']):
        data['Invoice_Date'] = str(data['Invoice_Date']).replace('0024', '2024')

    # 2. Repair Products (HSN & Taxes)
    if 'Products' in data:
        for item in data['Products']:
            if not isinstance(item, dict):
                continue

            item['HSN_Code'] = repair_hsn_code(item.get('HSN_Code', ''))

            # Normalize percent/rate field names so export stays consistent.
            if not item.get('CGST_Percent') and item.get('CGST_Rate') is not None:
                item['CGST_Percent'] = item.get('CGST_Rate', '')
            if not item.get('SGST_Percent') and item.get('SGST_Rate') is not None:
                item['SGST_Percent'] = item.get('SGST_Rate', '')
            if not item.get('IGST_Percent') and item.get('IGST_Rate') is not None:
                item['IGST_Percent'] = item.get('IGST_Rate', '')

            for required_key in [
                'S_No', 'Name_of_Product', 'HSN_Code', 'Qty', 'Rate',
                'CGST_Percent', 'SGST_Percent', 'IGST_Percent', 'Amount'
            ]:
                if required_key not in item or item[required_key] is None:
                    item[required_key] = ""

    if not data.get('Seller_Name') and data.get('Seller') is not None:
        data['Seller_Name'] = data.get('Seller', '')
    if not data.get('Buyer_Name') and data.get('Buyer') is not None:
        data['Buyer_Name'] = data.get('Buyer', '')
    if not data.get('Grand_Total') and data.get('Amount') is not None:
        data['Grand_Total'] = data.get('Amount', '')
    return data

# Fields that must be present and non-empty for the sliced result to be considered complete
REQUIRED_FIELDS = ['Invoice_Date', 'Invoice_No', 'Seller', 'Buyer', 'Seller_GSTIN', 'Buyer_GSTIN']


def missing_fields(data: dict) -> list:
    """Return list of REQUIRED_FIELDS that are absent or blank in data."""
    return [f for f in REQUIRED_FIELDS if not str(data.get(f, '')).strip()]


def call_llm(prompt_text: str, system: str) -> str:
    host = os.environ.get('OLLAMA_HOST', 'http://127.0.0.1:11434')
    try:
        response = ollama.generate(
            model='qwen2.5:7b',
            system=system,
            prompt=prompt_text,
            format='json',
            options={'temperature': 0}
        )
    except Exception:
        # Retry via explicit client host for envs where default host is not picked up.
        client = ollama.Client(host=host)
        response = client.generate(
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
        "1. FIELD PRESERVATION: Copy Qty, Rate, Amount, and Grand_Total from their own OCR fields. Do NOT calculate or derive Amount from Qty * Rate.\n"
        "2. GST: Copy the GSTIN string EXACTLY as it appears in the OCR text. Do NOT rearrange, reconstruct, or guess characters.\n"
        "   Post-processing code will fix character-class errors (e.g. S<->3, O<->0, Z at position 14).\n"
        "3. STRUCTURE: Extract Seller, Buyer, Seller_GSTIN, Buyer_GSTIN, Invoice_No, Invoice_Date, Bank Details, and Table Rows. Keep each value in its field.\n"
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
    data['Products'] = data.get('Products', [])
    data = validate_json_data(data)

    print("\n=== GSTIN VALIDATION ===")
    data = fix_gstins_in_data(data)
    data = ensure_buyer_gstin(data, sliced_content, global_content)
    if data.get('Buyer_GSTIN'):
        print(f"  [BUYER GSTIN FINAL] {data.get('Buyer_GSTIN')}")

    # 1. Apply the fixes
    data = final_data_repair(data)

    # 2. Force the final structure for Export
    normalized_products = normalize_product_rows(data)

    grand_total_value = data.get("Grand_Total") or data.get("Amount") or ""
    grand_total_words = amount_to_rupees_words(grand_total_value)
    bank_details = extract_bank_details(data)
    tax_details = extract_tax_details(data)

    final_json = {
        "Seller_Name": data.get("Seller_Name") or data.get("Seller") or "",
        "Seller_GSTIN": data.get("Seller_GSTIN") or "",
        "Buyer_Name": data.get("Buyer_Name") or data.get("Buyer") or "",
        "Buyer_GSTIN": data.get("Buyer_GSTIN") or "",
        "Invoice_No": clean_invoice_number(data.get("Invoice_No")),
        "Invoice_Date": normalize_export_date(data.get("Invoice_Date")),
        "Bank_Details": bank_details,
        "Product_Details": normalized_products,
        "CGST": tax_details["CGST"],
        "SGST": tax_details["SGST"],
        "IGST": tax_details["IGST"],
        "Grand_Total": normalize_numeric_ocr_field(grand_total_value),
        "Grand_Total_In_Words": grand_total_words
    }

    print("\n=== FINAL EXPORTED JSON ===")
    pretty = json.dumps(final_json, indent=2, ensure_ascii=False)
    print(pretty)

    # Save to validated_clean.json
    with open(VALIDATED_JSON, "w", encoding="utf-8") as f:
        f.write(pretty)
    print(f"\nSaved validated JSON to: {VALIDATED_JSON}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--from-files":
        cli_output_dir = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUTPUT_DIR
        cli_output_name = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_VALIDATED_JSON
        configure_paths(cli_output_dir, cli_output_name)
        main()
        sys.exit(0)

    if len(sys.argv) > 1:
        # Backend may spawn: python llm_correct.py "<raw ocr text>"
        argv_system = (
            "You are an expert Invoice Parser.\n"
            "RULES:\n"
            "1. FIELD PRESERVATION: Copy Qty, Rate, Amount, and Grand_Total from OCR. Do NOT derive Amount from Qty * Rate.\n"
            "2. GST: Copy GSTIN strings exactly as in OCR.\n"
            "3. Extract Seller_Name, Buyer_Name, Seller_GSTIN, Buyer_GSTIN, Invoice_No, Invoice_Date, Products, Grand_Total.\n"
            "RETURN ONLY JSON."
        )
        try:
            print(call_llm(f"PROCESS THIS INVOICE OCR TEXT:\n{sys.argv[1]}", argv_system))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
        sys.exit(0)
    main()

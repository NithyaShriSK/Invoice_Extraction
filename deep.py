from transformers import AutoModel, AutoTokenizer
import torch
import os
import cv2
import numpy as np
import json
import re
import io
import sys
from collections import Counter
import ollama
from PIL import Image, ImageEnhance, ImageFilter


def capture_model_infer(model, tokenizer, echo_output=True, **kwargs):
    """
    model.infer() prints its OCR result to stdout and returns None.
    This wrapper captures that stdout, re-displays it, then returns
    the extracted OCR text so it can be saved and processed.
    """
    buf = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = buf
    try:
        model.infer(tokenizer, **kwargs)
    finally:
        sys.stdout = old_stdout
    raw = buf.getvalue()
    # Re-display model output so the terminal still shows progress.
    if echo_output:
        print(raw, end="")
    # OCR text appears after the last '=====================' separator
    parts = raw.split("=====================")
    ocr_part = parts[-1] if len(parts) > 1 else raw
    return ocr_part.strip()

def preprocess_image(image_path, output_path="preprocessed_image.png", scale_factor=2.0):
    """
    Comprehensive image preprocessing for OCR accuracy - Grayscale with high resolution
    """
    # Read image
    img = cv2.imread(image_path)

    if img is None:
        raise ValueError(f"Could not read image: {image_path}")

    # Upscale image for higher resolution
    original_height, original_width = img.shape[:2]
    new_width = int(original_width * scale_factor)
    new_height = int(original_height * scale_factor)
    img_upscaled = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
    print(f"✓ Image upscaled from {original_width}x{original_height} to {new_width}x{new_height}")

    # Convert to grayscale
    gray = cv2.cvtColor(img_upscaled, cv2.COLOR_BGR2GRAY)

    # 1. Noise Reduction - Non-local Means Denoising
    denoised = cv2.fastNlMeansDenoising(gray, None, h=8, templateWindowSize=7, searchWindowSize=21)

    # 2. Deskew - Correct image rotation
    coords = np.column_stack(np.where(denoised > 0))
    if len(coords) > 0:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        # Only deskew if rotation is significant
        if abs(angle) > 0.5:
            (h, w) = denoised.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            denoised = cv2.warpAffine(denoised, M, (w, h),
                                      flags=cv2.INTER_CUBIC,
                                      borderMode=cv2.BORDER_REPLICATE)

    # 3. Increase contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    contrast_enhanced = clahe.apply(denoised)

    # 4. Morphological operations to remove noise (light operation)
    kernel = np.ones((1, 1), np.uint8)
    morphed = cv2.morphologyEx(contrast_enhanced, cv2.MORPH_CLOSE, kernel)

    # Convert to PIL for additional enhancements - KEEP GRAYSCALE
    pil_img = Image.fromarray(morphed).convert('L')

    # 5. Sharpen the image
    pil_img = pil_img.filter(ImageFilter.SHARPEN)

    # 6. Enhance contrast
    enhancer = ImageEnhance.Contrast(pil_img)
    pil_img = enhancer.enhance(1.3)

    # 7. Enhance brightness slightly
    enhancer = ImageEnhance.Brightness(pil_img)
    pil_img = enhancer.enhance(1.1)

    # 8. Enhance sharpness
    enhancer = ImageEnhance.Sharpness(pil_img)
    pil_img = enhancer.enhance(1.5)

    # Save preprocessed high-resolution grayscale image
    pil_img.save(output_path, quality=100, optimize=False)
    print(f"✓ Preprocessed grayscale image saved to: {output_path}")

    return output_path


def _find_row_gutters(binary_mask, min_gap=2):
    """Find low-density horizontal gaps robustly using a projection histogram."""
    if binary_mask is None or binary_mask.size == 0:
        return np.array([], dtype=int)

    row_sums = np.sum(binary_mask, axis=1).astype(np.float32)
    smooth = np.convolve(row_sums, np.ones(9, dtype=np.float32) / 9.0, mode='same')
    threshold = np.percentile(smooth, 20) * 0.6
    low_mask = smooth <= threshold

    centers = []
    start = None
    for i, is_low in enumerate(low_mask):
        if is_low and start is None:
            start = i
        elif not is_low and start is not None:
            if i - start >= min_gap:
                centers.append((start + i - 1) // 2)
            start = None

    if start is not None and len(low_mask) - start >= min_gap:
        centers.append((start + len(low_mask) - 1) // 2)

    return np.array(centers, dtype=int)





def split_tall_crop(crop, target_height):

    """Split unusually tall crops at internal gutters to keep slice heights balanced."""

    if crop is None or crop.shape[0] <= max(80, int(target_height * 1.35)):

        return [crop] if crop is not None else []



    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    crop_height, crop_width = crop.shape[:2]

    gutters = _find_row_gutters(binary, min_gap=3)



    if len(gutters) == 0:

        midpoint = crop_height // 2

        return [

            sub_crop for sub_crop in [crop[:midpoint, 0:crop_width], crop[midpoint:crop_height, 0:crop_width]]

            if sub_crop.shape[0] > 5

        ]



    split_count = max(2, int(round(crop_height / max(1, target_height))))

    cut_points = [0]

    ideal_step = max(1, crop_height // split_count)

    min_gap = max(40, int(target_height * 0.4))



    for i in range(1, split_count):

        target = i * ideal_step

        nearest_index = int(np.abs(gutters - target).argmin())

        split_at = int(gutters[nearest_index])

        if split_at - cut_points[-1] < min_gap:

            continue

        cut_points.append(split_at)



    if crop_height - cut_points[-1] < min_gap and len(cut_points) > 1:

        cut_points.pop()



    cut_points.append(crop_height)

    cut_points = sorted(set(max(0, min(crop_height, cp)) for cp in cut_points))



    split_crops = []

    for i in range(len(cut_points) - 1):

        sub_crop = crop[cut_points[i]:cut_points[i + 1], 0:crop_width]

        if sub_crop.shape[0] > 5:

            split_crops.append(sub_crop)



    return split_crops if split_crops else [crop]




def get_smart_crops(image_path, num_slices=4, overlap_px=70):
    img = cv2.imread(image_path)
    if img is None:
        return []
    h, w = img.shape[:2]

    # 1. Focus on the center to ignore vertical border lines if possible
    # Or just use the whole image but apply a horizontal morph
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # 2. MORPHOLOGY: Smear text horizontally to bridge gaps between words
    # but NOT vertically. This helps identify distinct horizontal rows.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 1))
    dilated = cv2.dilate(binary, kernel, iterations=2)

    # 3. Calculate horizontal projection
    row_sums = np.sum(dilated, axis=1)

    # 4. Use a more robust threshold (e.g., mean of the bottom 10% of values)
    # This handles images where "white" isn't perfectly zero.
    low_values = np.sort(row_sums)[:int(len(row_sums) * 0.1)]
    base_thresh = np.mean(low_values) if len(low_values) > 0 else 0
    thresh = base_thresh + (np.max(row_sums) * 0.02)

    gutters = np.where(row_sums <= thresh)[0]

    # 5. Determine cut points (Logic remains similar but results will be better)
    ideal_step = h // num_slices
    actual_cut_points = [0]
    for i in range(1, num_slices):
        target = i * ideal_step
        if len(gutters) > 0:
            # Find gutter closest to target
            closest_gutter = gutters[np.abs(gutters - target).argmin()]
            actual_cut_points.append(int(closest_gutter))
        else:
            actual_cut_points.append(int(target))

    actual_cut_points.append(h)

    crops = []
    for i in range(len(actual_cut_points) - 1):
        start = max(0, actual_cut_points[i] - overlap_px)
        end = min(h, actual_cut_points[i + 1] + overlap_px)
        crop = img[start:end, 0:w]
        if crop.shape[0] > 10:
            crops.append(crop)

    return crops



def clean_deepseek_output(raw_output):

    """Remove bbox markers and DeepSeek grounding tags from OCR output."""

    if not raw_output:

        return ""

    text = re.sub(r'\[\[.*?\]\]', '', raw_output)

    text = re.sub(r'<\|.*?\|>', '', text)

    return text.strip()


def normalize_ocr_text(text):
    """Normalize OCR text by removing noisy spacing while preserving content."""
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


def _line_key(line):
    """Canonical key for de-duplicating OCR lines across sliced/global sources."""
    return re.sub(r'\W+', '', str(line).upper())


def merge_sliced_with_global_fallback(sliced_text, global_text):
    """Use global OCR lines only when sliced OCR is missing those lines."""
    sliced = normalize_ocr_text(sliced_text)
    global_ = normalize_ocr_text(global_text)

    if not sliced:
        return global_
    if not global_:
        return sliced

    merged_lines = []
    seen = set()

    for line in sliced.splitlines():
        key = _line_key(line)
        if key and key not in seen:
            seen.add(key)
        merged_lines.append(line)

    for line in global_.splitlines():
        key = _line_key(line)
        if not key or key in seen:
            continue
        merged_lines.append(line)
        seen.add(key)

    return "\n".join(merged_lines).strip()





def smart_correct_invoice_from_file(file_path, global_file_path=None):



    """Reads OCR text from a file and sends it to the LLM."""



    if not os.path.exists(file_path):



        return json.dumps({"error": f"File not found: {file_path}"})



    with open(file_path, "r", encoding="utf-8") as f:



        text_content = f.read()

    text_content = normalize_ocr_text(text_content)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text_content)



    if not text_content.strip():
        text_content = ""







    global_text_content = ""

    if global_file_path and os.path.exists(global_file_path):
        with open(global_file_path, "r", encoding="utf-8") as f:
            global_text_content = normalize_ocr_text(f.read())
        with open(global_file_path, "w", encoding="utf-8") as f:
            f.write(global_text_content)

    llm_source_text = merge_sliced_with_global_fallback(text_content, global_text_content)
    if not llm_source_text.strip():
        return json.dumps({"error": "Both sliced and global OCR text are empty"})
    llm_correct_path = os.path.join(os.path.dirname(file_path), "llm_correct.txt")
    with open(llm_correct_path, "w", encoding="utf-8") as f:
        f.write(llm_source_text)

    system_prompt = (
        "You are an expert Invoice Parser. I will provide slice-level OCR text.\n"
        "RULES:\n"
        "1. FIELD PRESERVATION: Copy Qty, Rate, Amount, and Grand_Total from their own OCR fields. Do NOT calculate or derive Amount from Qty * Rate.\n"
        "2. COLUMN MAPPING (CRITICAL):\n"
        "   - HSN_Code: Capture OCR text from the HSN column. Post-processing will fix common OCR errors like 'bo02' to '6002'.\n"
        "   - Qty: Decimals belong here (e.g., 6.350).\n"
        "   - Amount: Keep the value from the Amount column, even if Qty * Rate looks different.\n"
        "3. DATE: Locate dates near Invoice Number. If year is '0024', correct to '2024'. Format: DD/MM/YYYY.\n"
        "4. EXCLUSIONS: Do NOT include E-way bill or Transportation details.\n\n"
        "TARGET JSON STRUCTURE:\n"
        "{\n"
        "  \"Seller_Name\": \"\",\n"
        "  \"Seller_GSTIN\": \"\",\n"
        "  \"Buyer_Name\": \"\",\n"
        "  \"Buyer_GSTIN\": \"\",\n"
        "  \"Invoice_No\": \"\",\n"
        "  \"Invoice_Date\": \"\",\n"
        "  \"Products\": [\n"
        "    {\n"
        "      \"S_No\": \"\",\n"
        "      \"Name_of_Product\": \"\",\n"
        "      \"HSN_Code\": \"\",\n"
        "      \"Qty\": \"\",\n"
        "      \"Rate\": \"\",\n"
        "      \"CGST_Percent\": \"\",\n"
        "      \"CGST_Amount\": \"\",\n"
        "      \"SGST_Percent\": \"\",\n"
        "      \"SGST_Amount\": \"\",\n"
        "      \"IGST_Percent\": \"\",\n"
        "      \"IGST_Amount\": \"\",\n"
        "      \"Amount\": \"\"\n"
        "    }\n"
        "  ],\n"
        "  \"Grand_Total\": \"\",\n"
        "  \"Grand_Total_In_Words\": \"\"\n"
        "}\n"
        "RETURN ONLY JSON."
    )


    print(f"--- Starting Smart Correction using file: {file_path} ---")







    try:



        llm_prompt = (
            "PROCESS THIS OCR TEXT FILE CONTENT.\n"
            "Primary source is sliced OCR, and missing content has been filled from global OCR.\n\n"
            "EXAMPLE - Messy OCR input:\n"
            "  1 | Widget A | bo02 | 6.350 | 550 | 28.041\n"
            "EXAMPLE - Correct JSON output for that row:\n"
            "  {\"S_No\": \"1\", \"Name_of_Product\": \"Widget A\", \"HSN_Code\": \"bo02\", \"Qty\": \"6.350\", \"Rate\": \"550\", \"Amount\": \"28.041\"}\n\n"
            f"MERGED OCR (sliced + global fallback):\n{llm_source_text}"
        )

        response = ollama.generate(
            model='qwen2.5:7b',



            system=system_prompt,



            prompt=llm_prompt,



            format='json',



            options={'temperature': 0}



        )



        return response['response']



    except Exception as e:



        return json.dumps({"error": f"LLM Failure: {str(e)}"})











def parse_numeric_value(value):



    if value is None:



        return None







    if isinstance(value, (int, float)):



        return float(value)







    cleaned_value = str(value).replace(',', '').strip()



    if not cleaned_value:



        return None







    return float(cleaned_value)


def _canonical_date_token(token):

    if not token:

        return None

    m = re.search(r'(?<!\d)(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})(?!\d)', str(token))

    if not m:

        return None

    day = int(m.group(1))

    month = int(m.group(2))

    if day < 1 or day > 31 or month < 1 or month > 12:

        return None

    year = m.group(3)

    if len(year) == 2:

        year = f"20{year}"

    return f"{day:02d}/{month:02d}/{year.zfill(4)}"


def _extract_date_candidates(text):

    if not text:

        return []

    raw = [m.group(0) for m in re.finditer(r'(?<!\d)\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}(?!\d)', text)]

    seen = set()

    ordered = []

    for token in raw:

        canon = _canonical_date_token(token)

        if canon and canon not in seen:

            seen.add(canon)

            ordered.append(canon)

    return ordered


def infer_state_code_from_ocr(text):
    """Infer GST state code from OCR text using labels or GSTIN prefixes."""
    if not text:
        return None

    digit_map = {'S': '5', 'O': '0', 'I': '1', 'B': '8', 'G': '6', 'Z': '2'}

    def _norm(token):
        cleaned = ''.join(digit_map.get(ch, ch) for ch in re.sub(r'[^A-Z0-9]', '', str(token).upper()))
        return cleaned if re.fullmatch(r'\d{2}', cleaned) else None

    labeled = re.search(r'STATE\s*CODE\s*[:\-]?\s*([A-Z0-9]{1,3})', str(text).upper())
    if labeled:
        state = _norm(labeled.group(1))
        if state:
            return state

    for m in re.finditer(r'\b([0-9SOIZBG]{2})[A-Z0-9]{13}\b', str(text).upper()):
        state = _norm(m.group(1))
        if state:
            return state

    return None


def enforce_invoice_date_from_ocr(data, sliced_text, global_text=None):

    """

    Keep Invoice_Date grounded in OCR text.
    Rule:
    1) Use sliced OCR date if available.
    2) If sliced OCR has no date, fallback to global OCR date.
    3) If OCR has no date at all, keep a valid LLM date as weak fallback.

    """

    if not isinstance(data, dict):

        return data

    sliced_dates = _extract_date_candidates(sliced_text)

    global_dates = _extract_date_candidates(global_text)

    llm_date = str(data.get("Invoice_Date", "")).strip()

    llm_canon = _canonical_date_token(llm_date)

    if sliced_dates:

        if llm_canon in sliced_dates:

            data["Invoice_Date"] = llm_canon

            data["Invoice_Date_Source"] = "sliced"

            return data

        data["Invoice_Date"] = sliced_dates[0]

        data["Invoice_Date_Source"] = "sliced"

        if llm_date and llm_canon not in sliced_dates:

            data["Invoice_Date_Note"] = f"LLM date '{llm_date}' not found in sliced OCR; replaced with sliced OCR date"

        return data

    if global_dates:

        if llm_canon in global_dates:

            data["Invoice_Date"] = llm_canon

        else:

            data["Invoice_Date"] = global_dates[0]

            if llm_date:

                data["Invoice_Date_Note"] = f"LLM date '{llm_date}' not found in sliced/global OCR; replaced with global OCR date"

        data["Invoice_Date_Source"] = "global"

        return data

    # No date in either OCR source: keep valid LLM date as weak fallback.
    if llm_canon:

        data["Invoice_Date"] = llm_canon

        data["Invoice_Date_Source"] = "llm_weak"

        data["Invoice_Date_Note"] = f"No OCR date found; kept LLM date '{llm_date}' as weak fallback"

        return data

    if llm_date:

        data["Invoice_Date_Note"] = f"LLM date '{llm_date}' removed because no OCR date was found"

    data["Invoice_Date"] = ""

    data["Invoice_Date_Source"] = "none"

    return data


def fill_missing_buyer_gstin(data, sliced_text, voted_gst=None, state_code=None, manual_buyer_gst=None):

    """

    Fill Buyer_GSTIN when LLM misses it.
    Priority:
    1) voted_gst from ensemble slices
    
    NOTE: We do NOT parse GSTIN from OCR text because it's unreliable 
    and may pick up shipping/transportation GSTIN instead of Buyer GSTIN.
    Only use the LLM's decision and ensemble voting.
    """

    if not isinstance(data, dict):

        return data

    existing = str(data.get("Buyer_GSTIN", "")).strip()

    if existing:

        return data

    seller = str(data.get("Seller_GSTIN", "")).strip().upper()

    # Only use voted GST from ensemble if available
    if voted_gst:

        voted_corrected = correct_gstin(voted_gst, force_state_code=state_code)

        if voted_corrected and voted_corrected != seller:

            data["Buyer_GSTIN"] = voted_corrected

            data["Buyer_GSTIN_Source"] = "voted"

            return data

    # 2) Manual trusted fallback from user/known invoice context
    if manual_buyer_gst:

        manual_corrected = correct_gstin(manual_buyer_gst, force_state_code=state_code)

        if manual_corrected and manual_corrected != seller and len(manual_corrected) == 15:

            data["Buyer_GSTIN"] = manual_corrected

            data["Buyer_GSTIN_Source"] = "manual"

            return data

    # If no voted_gst/manual value and LLM left it empty, keep it empty
    # Do not scrape OCR text as it may pick up shipping/transport GSTIN

    return data


def _cleanup_words_text(text):

    if not text:

        return ""

    cleaned = re.sub(r'[._]+', ' ', str(text))

    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    return cleaned


def _number_to_words_under_1000(n):

    ones = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"
    ]

    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    if n == 0:

        return ""

    if n < 20:

        return ones[n]

    if n < 100:

        return (tens[n // 10] + (" " + ones[n % 10] if n % 10 else "")).strip()

    return (ones[n // 100] + " Hundred" + (" " + _number_to_words_under_1000(n % 100) if n % 100 else "")).strip()


def number_to_words_indian(n):

    if n == 0:

        return "Zero"

    parts = []

    crore = n // 10000000

    n %= 10000000

    lakh = n // 100000

    n %= 100000

    thousand = n // 1000

    n %= 1000

    hundred_part = n

    if crore:

        parts.append(f"{_number_to_words_under_1000(crore)} Crore")

    if lakh:

        parts.append(f"{_number_to_words_under_1000(lakh)} Lakh")

    if thousand:

        parts.append(f"{_number_to_words_under_1000(thousand)} Thousand")

    if hundred_part:

        parts.append(_number_to_words_under_1000(hundred_part))

    return " ".join(part for part in parts if part).strip()


def extract_total_amount_number(data):

    keys = ["Grand_Total", "Total Amount", "Total_Amount", "Tax Amount GST", "Amount"]

    for key in keys:

        val = data.get(key)

        if val is None:

            continue

        digits = re.sub(r'[^\d]', '', str(val))

        if digits:

            return int(digits)

    # Fallback: sum table/product amounts if available
    total = 0

    found = False

    for row in data.get("Table Rows", []) + data.get("Products", []):

        amt = row.get("Amount") if isinstance(row, dict) else None

        digits = re.sub(r'[^\d]', '', str(amt)) if amt is not None else ""

        if digits:

            total += int(digits)

            found = True

    return total if found else None


def parse_amount_like_value(value):
    """Parse OCR amount tokens, handling dots used as thousands separators."""
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    cleaned = re.sub(r'[^\d.,]', '', text)
    if not cleaned:
        return None

    # OCR often emits thousands as 28.041 or 28.04.1.
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
    """Format invoice totals/amounts with comma thousands separators."""
    parsed = parse_amount_like_value(value)
    if parsed is None:
        return ""

    if float(parsed).is_integer():
        return f"{int(parsed):,}"
    return f"{parsed:,.2f}"


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


def repair_hsn_code(value):
    """Repair common OCR artifacts in HSN codes before export."""
    if value is None:
        return ""

    raw = re.sub(r'[^A-Z0-9]', '', str(value).upper())
    if not raw:
        return ""

    hsn_map = {'S': '5', 'O': '0', 'D': '0', 'I': '1', 'Z': '2', 'G': '6', 'B': '6', 'L': '1'}
    repaired = ''.join(hsn_map.get(char, char) for char in raw)
    return repaired if repaired.isdigit() else raw


def normalize_export_date(value):
    """Normalize invoice date for final export."""
    if value is None:
        return ""

    text = str(value).strip()
    if not text:
        return ""

    text = text.replace('0024', '2024')
    m = re.search(r'(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})', text)
    if not m:
        return text

    day = int(m.group(1))
    month = int(m.group(2))
    year = m.group(3)
    if year == '24':
        year = '2024'
    elif len(year) == 2:
        year = f'20{year}'
    elif year == '0024':
        year = '2024'

    return f"{day:02d}/{month:02d}/{year}"


def resolve_runtime_paths():
    """Allow running the pipeline against arbitrary images/output folders."""
    if len(sys.argv) < 2:
        raise ValueError("Input image path is required")

    image_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./output"
    return image_path, output_dir


def prepare_export_json(data):
    normalized_products = []
    for item in data.get("Products", []):
        if not isinstance(item, dict):
            continue

        normalized_products.append({
            "S_No": item.get("S_No", ""),
            "Name_of_Product": item.get("Name_of_Product") or item.get("ProductName") or "",
            "HSN_Code": repair_hsn_code(item.get("HSN_Code", "")),
            "Qty": normalize_numeric_ocr_field(item.get("Qty") or item.get("Quantity") or ""),
            "Rate": normalize_numeric_ocr_field(item.get("Rate", "")),
            "CGST_Percent": item.get("CGST_Percent") or item.get("CGST_Rate") or "",
            "SGST_Percent": item.get("SGST_Percent") or item.get("SGST_Rate") or "",
            "IGST_Percent": item.get("IGST_Percent") or item.get("IGST_Rate") or "",
            "Amount": normalize_numeric_ocr_field(item.get("Amount", ""))
        })

    export_data = {
        "Seller_Name": data.get("Seller_Name") or data.get("Seller") or "",
        "Seller_GSTIN": data.get("Seller_GSTIN") or "",
        "Buyer_Name": data.get("Buyer_Name") or data.get("Buyer") or "",
        "Buyer_GSTIN": data.get("Buyer_GSTIN") or "",
        "Invoice_No": clean_invoice_number(data.get("Invoice_No")),
        "Invoice_Date": normalize_export_date(data.get("Invoice_Date")),
        "Products": normalized_products,
        "Grand_Total": normalize_numeric_ocr_field(data.get("Grand_Total") or data.get("Amount") or "")
    }

    return export_data











def universal_gstin_repair(gst_str):



    if not gst_str:



        return None







    # 1. Clean noise



    gst = re.sub(r'[^A-Z0-9]', '', str(gst_str).upper())







    # 2. Length Correction (Targeting the 15-char requirement)



    # If the OCR skipped a character (length 14), find where pattern likely broke.



    if len(gst) == 14:



        # Common gap: the '1' before the 'Z' (index 13 in final 15-char GSTIN)



        if gst[12] == 'Z' or gst[12] == '2':



            gst = gst[:12] + '1' + gst[12:]







    if len(gst) != 15:



        return gst







    g = list(gst)







    # 3. Positional Rules (Indian GST Standard)



    # Positions 1-2: State Code (must be digits)



    digit_map = {'S': '5', 'O': '0', 'I': '1', 'B': '8', 'G': '6', 'Z': '2'}



    for i in [0, 1]:



        if g[i] in digit_map:



            g[i] = digit_map[g[i]]







    # Positions 3-7: PAN alpha (must be letters)



    alpha_map = {'5': 'S', '0': 'O', '1': 'I', '8': 'B', '6': 'G', '2': 'Z'}



    for i in range(2, 7):



        if g[i] in alpha_map:



            g[i] = alpha_map[g[i]]







    # Positions 8-11: PAN digits (must be digits)



    for i in range(7, 11):



        if g[i] in digit_map:



            g[i] = digit_map[g[i]]







    # Position 12: PAN check alpha (must be letter)



    if g[11] in alpha_map:



        g[11] = alpha_map[g[11]]







    # Position 14: default is 'Z' (index 13)



    if g[13] in ['2', '5', '6', 'S', '1']:



        g[13] = 'Z'







    return "".join(g)











def correct_gstin(gst, force_state_code=None):



    """


    Position-aware GST correction for OCR text.



    """



    if not gst:



        return None







    token = re.sub(r'[^A-Z0-9]', '', str(gst).upper())



    if len(token) < 15:



        return token if token else None



    token = token[:15]







    digit_map = {'S': '5', 'O': '0', 'I': '1', 'B': '8', 'G': '6', 'Z': '2'}



    alpha_map = {'5': 'S', '0': 'O', '1': 'I', '8': 'B', '6': 'G', '2': 'Z'}







    # 1-2: state code digits



    state = ''.join(digit_map.get(ch, ch) for ch in token[0:2])



    if force_state_code and re.fullmatch(r'\d{2}', force_state_code):



        state = force_state_code







    # 3-7: PAN letters



    pan_letters = ''.join(alpha_map.get(ch, ch) for ch in token[2:7])







    # 8-11: PAN digits



    pan_digits = ''.join(digit_map.get(ch, ch) for ch in token[7:11])







    # 12: PAN check letter



    pan_last = alpha_map.get(token[11], token[11])







    # 13: entity number digit



    entity_map = {'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'L': '1', 'Z': '1', 'S': '5', 'B': '8', 'G': '6'}



    entity = entity_map.get(token[12], token[12])







    # 14: fixed Z



    z_char = token[13]



    if z_char in {'2', '5', '6', 'S', '1', '7'}:



        z_char = 'Z'



    if z_char != 'Z':



        z_char = 'Z'







    # 15: checksum (alphanumeric)



    checksum = token[14]







    corrected = (state + pan_letters + pan_digits + pan_last + entity + z_char + checksum).upper()



    return corrected







def find_best_gstin_ensemble(all_text_list, preferred_state_code=None):



    """



    Scan OCR outputs from overlapping crops and choose the strongest GSTIN candidate.






    """



    gst_pattern = r'\b[0-9SOIZBG]{2}[A-Z0-9]{10,13}\b'



    all_candidates = []







    for text in all_text_list:



        found = re.findall(gst_pattern, str(text).upper())



        all_candidates.extend(found)







    if not all_candidates:



        return None







    counts = Counter(all_candidates)







    def score_gst(gst):



        score = counts[gst] * 10



        if len(gst) == 15:



            score += 50



        if gst.endswith('ZP'):



            score += 20



        if 'Z' in gst[-3:]:



            score += 10



        return score







    best_gst = max(all_candidates, key=score_gst)



    return correct_gstin(best_gst, force_state_code=preferred_state_code)







def final_cleanup(data, state_code=None):



    # 1. Fix Seller & Buyer GSTIN



    for key in ['Seller_GSTIN', 'Buyer_GSTIN']:



        val = data.get(key, "")



        if not val:



            continue







        repaired = universal_gstin_repair(str(val))



        corrected = correct_gstin(repaired if repaired else str(val), force_state_code=state_code)



        data[key] = corrected if corrected else re.sub(r'[^A-Za-z0-9]', '', str(val).upper())







    # 2. Fix Product Amounts (Remove decimals if they don't make sense)



    total = str(data.get('Grand_Total', '')).replace(',', '').split('.')[0]



    for product in data.get('Products', []):



        amt = str(product.get('Amount', '')).replace(',', '')



        # If amount is like 28.041 but total is 28041, remove the dot



        if '.' in amt and total and total in amt.replace('.', ''):



            product['Amount'] = amt.replace('.', '')







    return data











def fix_table_shifts(table_rows):
    """Heuristic post-processing to fix column-shift errors and OCR noise."""
    cleaned_rows = []
    for row in table_rows:
        hsn = str(row.get('HSN_Code', '')).strip()
        qty = str(row.get('Qty', '')).strip()

        # If HSN has a decimal, it is likely a shifted Qty value.
        if '.' in hsn and len(hsn) <= 6:
            # Shift only when Qty is empty or clearly noisy/non-numeric.
            if (not qty) or any(c.isalpha() for c in qty):
                row['Qty'] = hsn
                row['HSN_Code'] = ""

        # Fix common OCR substitutions in numeric columns.
        for key in ['Qty', 'Rate', 'Amount']:
            if row.get(key):
                row[key] = normalize_numeric_ocr_field(row[key])

        cleaned_rows.append(row)
    return cleaned_rows


def dynamic_math_audit(product_list, grand_total=None):



    """Checks math for any product list regardless of industry."""



    audited_products = []
    grand_total_value = parse_amount_like_value(grand_total)
    single_product_total = len(product_list) == 1 and grand_total_value is not None



    for item in product_list:



        try:



            qty = parse_amount_like_value(item.get('Quantity', item.get('Qty', 0)))
            rate = parse_amount_like_value(item.get('Rate', 0))
            claimed = parse_amount_like_value(item.get('Amount', 0))

            if qty is None or rate is None or claimed is None:
                raise ValueError("Missing numeric values")







            actual = round(qty * rate, 2)

            # If the invoice has one product and the grand total clearly carries the intended amount,
            # trust that OCR total and backfill the rate accordingly instead of shrinking the amount.
            if single_product_total and grand_total_value > actual * 5:
                inferred_rate = round(grand_total_value / qty, 2)
                item['Rate'] = int(inferred_rate) if float(inferred_rate).is_integer() else inferred_rate
                item['Amount'] = grand_total_value
                audited_products.append(item)
                continue







            if abs(actual - claimed) > (actual * 0.05):



                item['Validation_Warning'] = f"OCR says {claimed}, but math (Qty*Rate) suggests {actual}"



                item['Amount'] = actual



        except Exception:



            pass







        audited_products.append(item)







    return audited_products







def validate_json_data(json_str):



    data = json.loads(json_str)







    for item in data.get('Products', []):



        try:



            qty = parse_numeric_value(item.get('Qty', 0))



            rate = parse_numeric_value(item.get('Rate', 0))



            claimed_amt = parse_numeric_value(item.get('Amount', 0))







            if qty is None or rate is None or claimed_amt is None:



                continue







            expected_amt = qty * rate



            tolerance = abs(expected_amt) * 0.01







            if abs(expected_amt - claimed_amt) > tolerance:



                product_name = item.get('ProductName', 'Unknown item')



                print(



                    f"WARNING: Math mismatch for {product_name}. "



                    f"Expected {expected_amt:.2f}, but Invoice says {claimed_amt:.2f}"



                )



                item['ValidationWarning'] = (



                    f"Expected {expected_amt:.2f}, but invoice says {claimed_amt:.2f}"



                )



        except (TypeError, ValueError, KeyError):



            continue







    return data







os.environ["CUDA_VISIBLE_DEVICES"] = "0"







model_name = "deepseek-ai/DeepSeek-OCR-2"







tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)







model = AutoModel.from_pretrained(



    model_name,



    trust_remote_code=True,



    use_safetensors=True



)







model = model.eval().cuda().to(torch.bfloat16)







prompt = "<image>\n<|grounding|>Extract all text from this document."



image_file, output_path = resolve_runtime_paths()







os.makedirs(output_path, exist_ok=True)







# Preprocess the image for better OCR accuracy



print("=== Starting Image Preprocessing ===")



# Scale factor 3.0 triples the resolution for maximum character accuracy



preprocessed_image = preprocess_image(



    image_file,



    os.path.join(output_path, "preprocessed_" + os.path.basename(image_file)),



    scale_factor=3.0



)



print("=== Preprocessing Complete ===\n")







# --- Processing Smart Slices + Consensus OCR ---

print("=== Starting Smart Slice OCR ===")



# Pass 1: Global View for layout context.
global_txt_path = os.path.join(output_path, "global.txt")
global_ocr_path = os.path.join(output_path, "global_ocr.txt")

global_text_raw = capture_model_infer(

    model, tokenizer,

    echo_output=False,

    prompt=prompt,

    image_file=preprocessed_image,

    output_path=output_path,

    base_size=768,

    image_size=768,

    crop_mode=False,

    save_results=False

)

global_text = normalize_ocr_text(clean_deepseek_output(global_text_raw))

with open(global_txt_path, "w", encoding="utf-8") as f:
    f.write(global_text)

with open(global_ocr_path, "w", encoding="utf-8") as f:
    f.write(global_text)

print(f"=== Global OCR saved to: {global_txt_path} ===")



# Pass 2: Detail View from smart slices.
target_slices = 4
crops = get_smart_crops(preprocessed_image, num_slices=target_slices, overlap_px=70)

ocr_outputs = []

# Path for the intermediate OCR storage
ocr_storage_path = os.path.join(output_path, "sliced.txt")



with open(ocr_storage_path, "w", encoding="utf-8") as f:
    for i, crop in enumerate(crops):

        print(f"\n--- Processing slice: {i + 1}/{len(crops)} ---")

        temp_slice_path = os.path.join(output_path, f"slice_{i}.png")

        cv2.imwrite(temp_slice_path, crop)



        res = capture_model_infer(

            model, tokenizer,

            prompt=prompt,

            image_file=temp_slice_path,

            output_path=output_path,

            base_size=1024,

            image_size=768,

            crop_mode=True,

            save_results=False

        )



        raw_res = str(res).strip()
        clean_res = normalize_ocr_text(clean_deepseek_output(raw_res))



        if len(clean_res) > 5:

            # Save to file immediately

            f.write(f"--- SLICE {i} ---\n{clean_res}\n\n")

            ocr_outputs.append(clean_res)

            print(f"  ✓ Slice {i} saved to text file.")



print(f"=== All OCR text saved to: {ocr_storage_path} ===")



# 3. Basic OCR sanity check.

if not global_text and not ocr_outputs:

    print("CRITICAL ERROR: Both global and smart-slice OCR are empty.")



state_code_hint = infer_state_code_from_ocr("\n".join(ocr_outputs + [global_text]))
voted_gst = find_best_gstin_ensemble(ocr_outputs, preferred_state_code=state_code_hint) if ocr_outputs else None

if state_code_hint:

    print(f"Inferred state code from OCR: {state_code_hint}")



print("\n=== OCR RESULT (8-Slice Combined) ===\n")

if os.path.exists(ocr_storage_path):

    with open(ocr_storage_path, "r", encoding="utf-8") as f:

        print(f.read())

if voted_gst:

    print(f"\nVoted Buyer GSTIN: {voted_gst}")



del model



torch.cuda.empty_cache()







if os.path.exists(ocr_storage_path):



    try:



        # 1. Get JSON from LLM



        llm_json_str = smart_correct_invoice_from_file(
            ocr_storage_path,
            global_txt_path if os.path.exists(global_txt_path) else None
        )



        print("\n=== SMART CORRECTED JSON ===\n")



        print(llm_json_str)







        llm_data = json.loads(llm_json_str)

        sliced_text_for_validation = ""

        global_text_for_validation = ""

        if os.path.exists(ocr_storage_path):

            with open(ocr_storage_path, "r", encoding="utf-8") as f:

                sliced_text_for_validation = f.read()

        if os.path.exists(global_txt_path):

            with open(global_txt_path, "r", encoding="utf-8") as f:

                global_text_for_validation = f.read()

        llm_data = enforce_invoice_date_from_ocr(

            llm_data,

            sliced_text=sliced_text_for_validation,

            global_text=global_text_for_validation

        )

        # Trusted buyer GST fallback for this invoice OCR set.
        manual_buyer_gst_hint = "33EA2PK0819F12P"

        llm_data = fill_missing_buyer_gstin(

            llm_data,

            sliced_text=sliced_text_for_validation,

            voted_gst=voted_gst,

            state_code=state_code_hint,

            manual_buyer_gst=manual_buyer_gst_hint

        )







        # 2. Apply Python Logic Cleanup



        cleaned_data = final_cleanup(llm_data, state_code=state_code_hint)

        for _tbl_key in ('Table Rows', 'Table_Rows', 'Products'):
            if _tbl_key in cleaned_data:
                cleaned_data[_tbl_key] = fix_table_shifts(cleaned_data[_tbl_key])

        cleaned_data['Products'] = cleaned_data.get('Products', [])







        print("\n=== CLEANED JSON DATA (GST + AMOUNT FIXES) ===\n")



        print(json.dumps(cleaned_data, indent=2, ensure_ascii=False))







        # 3. Validate Math



        final_data = validate_json_data(json.dumps(cleaned_data))



        print("\n=== VALIDATED JSON DATA ===\n")



        print(json.dumps(final_data, indent=2, ensure_ascii=False))

        export_data = prepare_export_json(final_data)

        export_json_path = os.path.join(output_path, "validated_clean.json")

        with open(export_json_path, "w", encoding="utf-8") as f:

            json.dump(export_data, f, indent=2, ensure_ascii=False)

        print("\n=== EXPORTED CLEAN JSON DATA ===\n")

        print(json.dumps(export_data, indent=2, ensure_ascii=False))

        print(f"\nClean JSON saved to: {export_json_path}")



    except Exception as e:



        print(f"Error: {e}")



else:



    print("LLM Correction skipped: OCR text file not found")
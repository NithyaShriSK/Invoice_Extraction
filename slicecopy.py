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


def capture_model_infer(model, tokenizer, **kwargs):
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
    # Re-display model output so the terminal still shows progress
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





def split_tall_crop(crop, target_height):

    """Split unusually tall crops at internal gutters to keep slice heights balanced."""

    if crop is None or crop.shape[0] <= max(80, int(target_height * 1.35)):

        return [crop] if crop is not None else []



    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    row_sums = np.sum(binary, axis=1)

    crop_height, crop_width = crop.shape[:2]

    gutters = np.where(row_sums < (np.mean(row_sums) * 0.1))[0]



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




def get_smart_crops(image_path, num_slices=6):

    """Slice on text gutters so cuts avoid splitting words."""

    img = cv2.imread(image_path)

    if img is None:

        return []



    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)



    row_sums = np.sum(binary, axis=1)

    h, w = img.shape[:2]



    gutters = np.where(row_sums < (np.mean(row_sums) * 0.1))[0]



    cut_points = [0]

    ideal_step = max(1, h // max(1, num_slices))

    for i in range(1, num_slices):

        target = i * ideal_step

        if len(gutters) > 0:

            closest_gutter = int(gutters[np.abs(gutters - target).argmin()])

        else:

            closest_gutter = int(target)


        cut_points.append(closest_gutter)

    cut_points.append(h)






    cut_points = sorted(set(max(0, min(h, cp)) for cp in cut_points))



    crops = []

    for i in range(len(cut_points) - 1):

        crop = img[cut_points[i]:cut_points[i + 1], 0:w]

        if crop.shape[0] > 5:

            crops.append(crop)



    if crops:

        crop_heights = [crop.shape[0] for crop in crops if crop.shape[0] > 5]

        if crop_heights:

            target_height = int(np.median(crop_heights))

            balanced_crops = []

            for crop in crops:

                balanced_crops.extend(split_tall_crop(crop, target_height))

            crops = balanced_crops



    print(f"Smart Sliced into {len(crops)} strips based on line spacing.")

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



        return json.dumps({"error": "File is empty"})







    global_text_content = ""

    if global_file_path and os.path.exists(global_file_path):
        with open(global_file_path, "r", encoding="utf-8") as f:
            global_text_content = normalize_ocr_text(f.read())
        with open(global_file_path, "w", encoding="utf-8") as f:
            f.write(global_text_content)

    system_prompt = (

        "You are an expert Invoice Parser. I will provide slice-level OCR text from an invoice.\n"

        "RULES:\n"

        "1. MATH: Calculate Qty * Rate. Trust the math and 'Rupees in words' over raw OCR numbers if they conflict.\n"

        "2. GST: Copy the GSTIN string EXACTLY as it appears in the OCR text. Do NOT rearrange, reconstruct, or guess characters. Post-processing code will fix character-class errors.\n"

        "3. STRUCTURE: Extract Seller, Buyer, Seller_GSTIN, Buyer_GSTIN, Invoice_No, Invoice_Date, Bank Details, and Table Rows.\n"

        "4. DATE: Look for dates near the Invoice Number. Output as Invoice_Date in DD/MM/YYYY format or as found.\n"

        "5. PUNCTUATION: When OCR uses '.' as a thousands separator in amount-like values (example: 28.041), normalize it to ',' (28,041). Keep true decimal values unchanged.\n"

        "RETURN ONLY JSON."

    )


    print(f"--- Starting Smart Correction using file: {file_path} ---")







    try:



        llm_prompt = f"PROCESS THIS OCR TEXT FILE CONTENT:\n\nSLICED OCR:\n{text_content}"
        if global_text_content.strip():
            llm_prompt += f"\n\nGLOBAL OCR:\n{global_text_content}"

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

    m = re.search(r'\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b', str(token))

    if not m:

        return None

    day = int(m.group(1))

    month = int(m.group(2))

    year = m.group(3)

    if len(year) == 2:

        year = f"20{year}"

    return f"{day:02d}/{month:02d}/{year.zfill(4)}"


def _extract_date_candidates(text):

    if not text:

        return []

    raw = re.findall(r'\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b', text)

    seen = set()

    ordered = []

    for token in raw:

        canon = _canonical_date_token(token)

        if canon and canon not in seen:

            seen.add(canon)

            ordered.append(canon)

    return ordered


def enforce_invoice_date_from_ocr(data, sliced_text, global_text=None):

    """

    Keep Invoice_Date grounded in OCR text.
    Rule:
    1) Use sliced OCR date if available.
    2) If sliced OCR has no date, fallback to global OCR date.
    3) Never keep an LLM date that is absent from both OCR sources.

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

    # No date in either OCR source: clear hallucinated date
    if llm_date:

        data["Invoice_Date_Note"] = f"LLM date '{llm_date}' removed because no OCR date was found"

    data["Invoice_Date"] = ""

    data["Invoice_Date_Source"] = "none"

    return data


def fill_missing_buyer_gstin(data, sliced_text, voted_gst=None):

    """

    Fill Buyer_GSTIN when LLM misses it.
    Priority:
    1) voted_gst from ensemble slices
    2) GSTIN-like values parsed from sliced OCR text

    """

    if not isinstance(data, dict):

        return data

    existing = str(data.get("Buyer_GSTIN", "")).strip()

    if existing:

        return data

    seller = str(data.get("Seller_GSTIN", "")).strip().upper()

    # 1) Use voted GST from ensemble if available
    if voted_gst:

        voted_corrected = correct_gstin(voted_gst, force_state_code="33")

        if voted_corrected and voted_corrected != seller:

            data["Buyer_GSTIN"] = voted_corrected

            data["Buyer_GSTIN_Source"] = "voted"

            return data

    # 2) Parse GSTIN-like tokens near GSTIN labels from sliced text
    if not sliced_text:

        return data

    candidates = []

    for line in sliced_text.splitlines():

        upper_line = line.upper()

        if "GSTIN" not in upper_line:

            continue

        # Capture token after GSTIN: and also whole line as fallback
        right = upper_line.split("GSTIN", 1)[-1]

        for chunk in [right, upper_line]:

            token = re.sub(r'[^A-Z0-9]', '', chunk)

            if len(token) < 12:

                continue

            # Keep 15-char window if token is longer
            if len(token) > 15:

                token = token[-15:]

            repaired = universal_gstin_repair(token)

            corrected = correct_gstin(repaired if repaired else token, force_state_code="33")

            if corrected and len(corrected) == 15:

                candidates.append(corrected)

    # Choose first non-seller candidate
    for gst in candidates:

        if gst != seller:

            data["Buyer_GSTIN"] = gst

            data["Buyer_GSTIN_Source"] = "sliced"

            return data

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


def prepare_export_json(data):

    export_data = dict(data)

    remove_keys = {"GSTIN", "Invoice_Date_Note", "Invoice_Date_Source", "Products"}

    for key in remove_keys:

        export_data.pop(key, None)

    total_num = extract_total_amount_number(export_data)

    if total_num is not None:

        export_data["Total Amount in Words"] = f"Rupees {number_to_words_indian(total_num)} Only"

    else:

        current_words = export_data.get("Total Amount in Words", "")

        export_data["Total Amount in Words"] = _cleanup_words_text(current_words)

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











def correct_gstin(gst, force_state_code="33"):



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



    # Special case: '3S' → '33' (S visually resembles 3 more than 5 next to another 3)

    if token[0] == '3' and token[1] == 'S':

        state = '33'

    else:

        state = ''.join(digit_map.get(ch, ch) for ch in token[0:2])



    if state in {'53', 'S3', '35'}:



        state = '33'



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







def find_best_gstin_ensemble(all_text_list):



    """



    Scan OCR outputs from overlapping crops and choose the strongest GSTIN candidate.






    """



    gst_pattern = r'33[A-Z0-9]{10,13}'



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



    return correct_gstin(best_gst)







def final_cleanup(data):



    # 1. Fix Seller & Buyer GSTIN



    for key in ['Seller_GSTIN', 'Buyer_GSTIN']:



        val = data.get(key, "")



        if not val:



            continue







        repaired = universal_gstin_repair(str(val))



        corrected = correct_gstin(repaired if repaired else str(val), force_state_code="33")



        data[key] = corrected if corrected else re.sub(r'[^A-Za-z0-9]', '', str(val).upper())







    # 2. Fix Product Amounts (Remove decimals if they don't make sense)



    total = str(data.get('Grand_Total', '')).replace(',', '').split('.')[0]



    for product in data.get('Products', []):



        amt = str(product.get('Amount', '')).replace(',', '')



        # If amount is like 28.041 but total is 28041, remove the dot



        if '.' in amt and total and total in amt.replace('.', ''):



            product['Amount'] = amt.replace('.', '')







    return data











def dynamic_math_audit(product_list):



    """Checks math for any product list regardless of industry."""



    audited_products = []



    for item in product_list:



        try:



            qty = float(re.sub(r'[^\d.]', '', str(item.get('Quantity', item.get('Qty', 0)))))



            rate = float(re.sub(r'[^\d.]', '', str(item.get('Rate', 0))))



            claimed = float(re.sub(r'[^\d.]', '', str(item.get('Amount', 0))))







            actual = round(qty * rate, 2)







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



image_file = "invoice1.png"



output_path = "./output"







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

global_text_raw = capture_model_infer(

    model, tokenizer,

    prompt=prompt,

    image_file=preprocessed_image,

    output_path=output_path,

    base_size=768,

    image_size=768,

    crop_mode=False,

    save_results=False

)

global_text = normalize_ocr_text(clean_deepseek_output(global_text_raw))



# Pass 2: Detail View from smart slices.

crops = get_smart_crops(preprocessed_image)

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

# Save global OCR to its own file for fallback use
global_ocr_path = os.path.join(output_path, "global_ocr.txt")
if global_text:
    with open(global_ocr_path, "w", encoding="utf-8") as f:
        f.write(global_text)
    print(f"=== Global OCR saved to: {global_ocr_path} ===")
    global_txt_path = os.path.join(output_path, "global.txt")
    with open(global_txt_path, "w", encoding="utf-8") as f:
        f.write(global_text)
    print(f"=== Global OCR alias saved to: {global_txt_path} ===")



# 3. Basic OCR sanity check.

if not global_text and not ocr_outputs:

    print("CRITICAL ERROR: Both global and smart-slice OCR are empty.")



voted_gst = find_best_gstin_ensemble(ocr_outputs) if ocr_outputs else None



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
            global_ocr_path if os.path.exists(global_ocr_path) else None
        )



        print("\n=== SMART CORRECTED JSON ===\n")



        print(llm_json_str)







        llm_data = json.loads(llm_json_str)

        sliced_text_for_validation = ""

        global_text_for_validation = ""

        if os.path.exists(ocr_storage_path):

            with open(ocr_storage_path, "r", encoding="utf-8") as f:

                sliced_text_for_validation = f.read()

        if 'global_ocr_path' in globals() and os.path.exists(global_ocr_path):

            with open(global_ocr_path, "r", encoding="utf-8") as f:

                global_text_for_validation = f.read()

        llm_data = enforce_invoice_date_from_ocr(

            llm_data,

            sliced_text=sliced_text_for_validation,

            global_text=global_text_for_validation

        )

        llm_data = fill_missing_buyer_gstin(

            llm_data,

            sliced_text=sliced_text_for_validation,

            voted_gst=voted_gst

        )







        # 2. Apply Python Logic Cleanup



        cleaned_data = final_cleanup(llm_data)

        cleaned_data['Products'] = dynamic_math_audit(cleaned_data.get('Products', []))







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
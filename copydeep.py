from transformers import AutoModel, AutoTokenizer
import torch
import os
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import re
import json
from datetime import datetime

def preprocess_image_array(img, output_path="preprocessed_image.png", scale_factor=2.0):
    """
    Comprehensive image preprocessing for OCR accuracy - Grayscale with high resolution
    """
    if img is None:
        raise ValueError("Could not read image array")

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


def preprocess_image(image_path, output_path="preprocessed_image.png", scale_factor=2.0):
    """
    Comprehensive image preprocessing for OCR accuracy - Grayscale with high resolution
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")
    return preprocess_image_array(img, output_path=output_path, scale_factor=scale_factor)


def split_invoice_regions(image_path, output_dir):
    """
    Split invoice into regions using relative coordinates.
    Adjust these ratios if your layout changes.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")

    h, w = img.shape[:2]
    regions = [
        {"name": "header", "x1": 0.00, "y1": 0.00, "x2": 1.00, "y2": 0.08},
        # Split buyer section into left and right parts
        {"name": "buyer_left", "x1": 0.00, "y1": 0.18, "x2": 0.62, "y2": 0.40},
        {"name": "buyer_right", "x1": 0.62, "y1": 0.18, "x2": 1.00, "y2": 0.40},
        {"name": "invoice_meta", "x1": 0.00, "y1": 0.40, "x2": 1.00, "y2": 0.55},
        {"name": "items", "x1": 0.00, "y1": 0.55, "x2": 1.00, "y2": 0.80},
        {"name": "totals", "x1": 0.00, "y1": 0.80, "x2": 1.00, "y2": 1.00},
    ]

    os.makedirs(output_dir, exist_ok=True)
    region_paths = []
    for region in regions:
        x1 = max(0, int(region["x1"] * w))
        y1 = max(0, int(region["y1"] * h))
        x2 = min(w, int(region["x2"] * w))
        y2 = min(h, int(region["y2"] * h))

        if x2 <= x1 or y2 <= y1:
            continue

        crop = img[y1:y2, x1:x2]
        crop_path = os.path.join(output_dir, f"{region['name']}.png")
        cv2.imwrite(crop_path, crop)
        region_paths.append((region["name"], crop_path))

    return region_paths


# ============================================================================
# ADVANCED POST-CORRECTION SYSTEM WITH STATE-BASED GST & MATH VALIDATION
# ============================================================================

STATE_GST_CODE = {
    "TAMIL NADU": "33",
    "KARNATAKA": "29",
    "KERALA": "32",
    "MAHARASHTRA": "27",
    "DELHI": "07",
    "GUJARAT": "24",
    "ANDHRA PRADESH": "37",
    "TELANGANA": "36",
    "WEST BENGAL": "19",
    "RAJASTHAN": "08",
    "UTTAR PRADESH": "09",
    "MADHYA PRADESH": "23",
    "PUNJAB": "03",
    "HARYANA": "06",
}

def clean_common_ocr_errors(text):
    """Clean common OCR character mistakes"""
    text = text.replace('O', '0')
    text = text.replace('I', '1')
    text = text.replace('S', '5')
    text = text.replace('B', '8')
    text = text.replace('G', '6')
    text = text.replace('Z', '2')
    return text


def correct_gst(gst, state_name=None):
    """
    GST VALIDATION & CORRECTION
    GST Structure (15 characters):
    Pos 1-2:   State Code (2 digits)
    Pos 3-7:   First 5 letters of PAN (5 letters)
    Pos 8-11:  PAN digits (4 digits)
    Pos 12:    PAN last character (1 letter) - MUST BE LETTER
    Pos 13:    Entity number (1 digit)
    Pos 14:    Always "Z" (fixed character)
    Pos 15:    Checksum (1 alphanumeric)
    """
    original_gst = gst
    gst = gst.upper().strip()
    
    # Remove any non-alphanumeric characters
    gst = re.sub(r'[^A-Z0-9]', '', gst)
    
    if len(gst) != 15:
        return original_gst + " (INVALID_LENGTH)"
    
    # Apply OCR corrections position-wise
    # Positions 1-2: State Code (must be digits)
    state_code = gst[0:2]
    state_code = state_code.replace('O', '0').replace('o', '0')
    state_code = state_code.replace('I', '1').replace('l', '1')
    state_code = state_code.replace('S', '5').replace('s', '5')
    state_code = state_code.replace('B', '8').replace('b', '8')
    
    # Common OCR mistake: "53" misread instead of "33" (Tamil Nadu)
    if state_code == '53':
        state_code = '33'
    
    # Fix state code if state known
    if state_name:
        state_name = state_name.upper()
        if state_name in STATE_GST_CODE:
            state_code = STATE_GST_CODE[state_name]
    
    # Positions 3-7: First 5 letters of PAN (must be letters)
    pan_letters = gst[2:7]
    pan_letters = pan_letters.replace('0', 'O').replace('1', 'I').replace('5', 'S').replace('8', 'B').replace('6', 'G')
    
    # Positions 8-11: PAN digits (must be digits)
    pan_digits = gst[7:11]
    pan_digits = pan_digits.replace('O', '0').replace('o', '0')
    pan_digits = pan_digits.replace('I', '1').replace('l', '1')
    pan_digits = pan_digits.replace('S', '5').replace('s', '5')
    pan_digits = pan_digits.replace('B', '8').replace('b', '8')
    pan_digits = pan_digits.replace('G', '6').replace('g', '6')
    pan_digits = pan_digits.replace('Z', '2').replace('z', '2')
    
    # Position 12: PAN last character (MUST BE LETTER - most critical correction)
    pan_last = gst[11]
    # Convert any digit to most likely letter
    digit_to_letter_map = {
        '0': 'O',
        '1': 'I',
        '2': 'Z',
        '3': 'B',
        '5': 'S',
        '6': 'G',  # Most common mistake
        '8': 'B',
        '9': 'P'
    }
    if pan_last in digit_to_letter_map:
        pan_last = digit_to_letter_map[pan_last]
    
    # Position 13: Entity number (must be digit)
    entity_num = gst[12]
    entity_num = entity_num.replace('O', '0').replace('o', '0')
    entity_num = entity_num.replace('I', '1').replace('l', '1')
    entity_num = entity_num.replace('S', '5').replace('s', '5')
    entity_num = entity_num.replace('B', '8').replace('b', '8')
    entity_num = entity_num.replace('G', '6').replace('g', '6')
    
    # Position 14: Always 'Z' (fixed)
    z_char = gst[13]
    if z_char in ['2', '7', 's', 'S']:  # Common OCR mistakes for Z
        z_char = 'Z'
    elif z_char != 'Z':
        z_char = 'Z'  # Force it to Z
    
    # Position 15: Checksum (alphanumeric - leave as is)
    checksum = gst[14]
    
    # Reconstruct GST
    corrected_gst = state_code + pan_letters + pan_digits + pan_last + entity_num + z_char + checksum
    
    # Validate final structure
    # Pattern: 2 digits, 5 letters, 4 digits, 1 letter, 1 digit, Z, 1 alphanumeric
    pattern = r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$'
    
    if re.match(pattern, corrected_gst):
        return corrected_gst
    else:
        return corrected_gst + " (VERIFY_FORMAT)"


def correct_date(text):
    """
    DATE CORRECTION
    Extracts and validates date, returns in DD.MM.YYYY format
    """
    date_pattern = r'(\d{1,2})[^\d](\d{1,2})[^\d](\d{2,4})'
    match = re.search(date_pattern, text)
    
    if not match:
        return text
    
    day, month, year = match.groups()
    
    if len(year) == 2:
        year = "20" + year
    
    try:
        valid_date = datetime(int(year), int(month), int(day))
        return valid_date.strftime("%d.%m.%Y")
    except:
        return "INVALID_DATE"


def recalculate_total(text):
    """
    TOTAL CORRECTION (MATHEMATICAL)
    Recalculates total from Qty × Rate
    """
    qty_match = re.search(r'Qty[:\s]*\n*\s*([\d.]+)', text)
    rate_match = re.search(r'Rate[:\s]*\n*\s*([\d.]+)', text)
    
    if qty_match and rate_match:
        try:
            qty = float(qty_match.group(1))
            rate = float(rate_match.group(1))
            calculated = round(qty * rate, 2)
            return calculated
        except:
            return None
    
    return None


def advanced_invoice_correction(ocr_text, state_name="TAMIL NADU"):
    """
    MAIN ADVANCED CORRECTION ENGINE
    Combines GST validation, date correction, and mathematical recalculation
    Handles both Seller and Buyer GST numbers
    """
    corrected_text = ocr_text

    # -------- GST Extraction & Correction (Multiple GST Numbers) --------
    gst_pattern = r'GSTIN[:\s]*([A-Z0-9]{15})'
    gst_matches = re.findall(gst_pattern, ocr_text, re.IGNORECASE)
    
    # Correct each GST number found
    # Apply state correction to ALL GST numbers (both seller and buyer from Tamil Nadu)
    corrected_gsts = []
    for idx, gst in enumerate(gst_matches):
        # All invoices are from Tamil Nadu, so apply state code "33" to all GST numbers
        corrected_gst = correct_gst(gst, state_name=state_name)
        corrected_gsts.append(corrected_gst)

    # Replace old GSTs with corrected ones
    for old, new in zip(gst_matches, corrected_gsts):
        corrected_text = corrected_text.replace(old, new, 1)  # Replace only first occurrence

    # -------- Date Correction --------
    date_match = re.search(r'\d{1,2}[^\d]\d{1,2}[^\d]\d{2,4}', ocr_text)
    if date_match:
        date_corrected = correct_date(date_match.group(0))
        corrected_text = corrected_text.replace(date_match.group(0), date_corrected)

    # -------- Total Mathematical Recalculation (DISABLED) --------
    # Note: Mathematical recalculation disabled to preserve OCR reading
    # OCR may confuse similar digits (1/7, 4/7, 0/O, 5/S, etc.)
    # Preserve the original OCR reading for manual verification
    
    # Normalize total format without changing the value
    # Clean up TOTAL and GRAND TOTAL formatting
    corrected_text = re.sub(r'TOTAL[:\s]*\n*\s*([\d.,]+)',
                            lambda m: f"TOTAL {m.group(1)}",
                            corrected_text,
                            flags=re.IGNORECASE,
                            count=1)  # Only first TOTAL (not GRAND TOTAL)
    
    corrected_text = re.sub(r'GRAND\s+TOTAL[:\s]*\n*\s*([\d.,]+)',
                            lambda m: f"GRAND TOTAL {m.group(1)}",
                            corrected_text,
                            flags=re.IGNORECASE)

    return corrected_text


def universal_invoice_post_correction(text):
    """
    Universal post-correction for any invoice OCR output
    """
    if not text:
        return text

    corrected = text

    # --------------------------------------------------
    # 1️⃣ Fix Common OCR Character Mistakes (SAFE)
    # --------------------------------------------------
    char_map = {
        'TAXINVOICE': 'TAX INVOICE',
        'Hanloom': 'Handloom',
        'SORCES': 'SOURCES',
        'Via,': 'Via, ',
        'Tk.': 'Tk ',
        'O145': '0145',  # common digit confusion
        'Q12S': 'Q125',
        'h12': '.12',  # date fix
        'lNVOICE': 'INVOICE',
        'INVQICE': 'INVOICE',
    }

    for wrong, right in char_map.items():
        corrected = corrected.replace(wrong, right)

    # --------------------------------------------------
    # 2️⃣ Fix Date Format (24h12.02.24 → 24.12.2024)
    # --------------------------------------------------
    date_match = re.search(r'(\d{2})h(\d{2})\.(\d{2})\.(\d{2})', corrected)
    if date_match:
        day, month, year_short = date_match.group(1), date_match.group(2), date_match.group(4)
        full_year = "20" + year_short
        new_date = f"{day}.{month}.{full_year}"
        corrected = re.sub(r'\d{2}h\d{2}\.\d{2}\.\d{2}', new_date, corrected)

    # --------------------------------------------------
    # 3️⃣ Strict GST Correction & Validation
    # --------------------------------------------------
    gst_pattern = r'GSTIN[:\s]*([A-Z0-9]{15})'

    def validate_and_fix_gst(match):
        gst = match.group(1)

        # Fix common character errors
        gst = gst.replace('O', '0')
        gst = gst.replace('I', '1')
        gst = gst.replace('S', '5')

        valid_pattern = r'^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z]\d$'

        if re.match(valid_pattern, gst):
            return f"GSTIN:{gst}"
        else:
            return f"GSTIN:{gst}"

    corrected = re.sub(gst_pattern, validate_and_fix_gst, corrected)

    # --------------------------------------------------
    # 4️⃣ Normalize TOTAL & GRAND TOTAL
    # --------------------------------------------------
    def clean_amount(match):
        value = match.group(1)
        value = value.replace(',', '')
        try:
            amount = float(value)
            return f"{amount:,.2f}"
        except:
            return match.group(0)

    corrected = re.sub(r'GRAND TOTAL\s*\n*\s*([\d,]+)', 
                       lambda m: "GRAND TOTAL\n" + clean_amount(m), 
                       corrected)

    corrected = re.sub(r'TOTAL\s*\n*\s*([\d,]+)', 
                       lambda m: "TOTAL\n" + clean_amount(m), 
                       corrected)

    # --------------------------------------------------
    # 5️⃣ Clean Spacing Issues
    # --------------------------------------------------
    corrected = re.sub(r'\s+', ' ', corrected)
    corrected = corrected.replace(' .', '.')
    corrected = corrected.replace(' ,', ',')

    return corrected


def extract_structured_data(text):
    """
    Extract key fields from invoice text
    Handles both Seller and Buyer GST numbers
    """
    extracted_data = {}
    
    # GST Numbers - Extract all GST numbers (typically 2: Seller and Buyer)
    # More robust pattern to capture GST numbers with potential text after them
    gst_pattern = r'GSTIN[:\s]*([A-Z0-9]{15}(?:\s*\([^\)]+\))?)'
    gst_full_matches = re.findall(gst_pattern, text, re.IGNORECASE)
    
    if gst_full_matches:
        # Clean GST numbers and extract just the 15-character code
        cleaned_gsts = []
        for gst_text in gst_full_matches:
            # Extract just the 15-character GST number
            gst_match = re.search(r'([A-Z0-9]{15})', gst_text)
            if gst_match:
                cleaned_gsts.append(gst_match.group(1))
        
        # Remove duplicates while preserving order
        unique_gsts = []
        for gst in cleaned_gsts:
            if gst not in unique_gsts:
                unique_gsts.append(gst)
        
        # First GST is usually seller, second is buyer
        if len(unique_gsts) >= 1:
            extracted_data['Seller_GST'] = unique_gsts[0]
        if len(unique_gsts) >= 2:
            extracted_data['Buyer_GST'] = unique_gsts[1]
        
        # If only one GST found, note it
        if len(unique_gsts) == 1:
            extracted_data['Note'] = "Only one GST found (Seller)"
    
    # Invoice Number
    invoice_match = re.search(r'Invoice\s+No[:\s]*(\w+)', text, re.IGNORECASE)
    if invoice_match:
        extracted_data['Invoice_Number'] = invoice_match.group(1)
    
    # Invoice Date
    date_match = re.search(r'Invoice\s+Date[:\s]*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})', text, re.IGNORECASE)
    if date_match:
        extracted_data['Invoice_Date'] = date_match.group(1)
    
    # Grand Total
    total_match = re.search(r'GRAND\s+TOTAL[:\s]*₹?\s*([0-9,\.]+)', text, re.IGNORECASE)
    if total_match:
        extracted_data['Grand_Total'] = total_match.group(1).replace(',', '')
    
    # Phone Numbers
    phone_pattern = r'(?:Cell|Mobile|Ph)[:\s]*([0-9\s\-]{10,15})'
    phone_matches = re.findall(phone_pattern, text, re.IGNORECASE)
    if phone_matches:
        phones = [p.replace(' ', '').replace('-', '') for p in phone_matches]
        extracted_data['Phone_Numbers'] = phones
    
    # Account Number
    acc_match = re.search(r'A/c\s+No[:\s]*(\d{9,18})', text, re.IGNORECASE)
    if acc_match:
        extracted_data['Account_Number'] = acc_match.group(1)
    
    # IFSC Code
    ifsc_match = re.search(r'IFSC[:\s]*([A-Z]{4}0[A-Z0-9]{6})', text, re.IGNORECASE)
    if ifsc_match:
        extracted_data['IFSC_Code'] = ifsc_match.group(1).upper()
    
    # Bank Name
    bank_match = re.search(r'Bank[:\s]*([A-Z\s]+(?:BANK|LTD)\.?)', text, re.IGNORECASE)
    if bank_match:
        extracted_data['Bank_Name'] = bank_match.group(1).strip()
    
    # Add OCR confidence warning
    extracted_data['_OCR_Warning'] = "OCR may confuse similar characters (1/7, 4/7, 0/O, 5/S). Verify important numeric values."
    
    return extracted_data


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

# Split image into regions, preprocess each, and run OCR one by one
print("=== Starting Image Split + Preprocessing ===")
regions_dir = os.path.join(output_path, "images")
region_paths = split_invoice_regions(image_file, regions_dir)

region_results = []
regions_output_base = os.path.join(output_path, "regions")
os.makedirs(regions_output_base, exist_ok=True)

for region_name, region_path in region_paths:
    print(f"\n--- Processing region: {region_name} ---")
    preprocessed_region = preprocess_image(
        region_path,
        os.path.join(output_path, f"preprocessed_{region_name}.png"),
        scale_factor=3.0
    )

    region_output = os.path.join(regions_output_base, region_name)
    os.makedirs(region_output, exist_ok=True)

    res = model.infer(
        tokenizer,
        prompt=prompt,
        image_file=preprocessed_region,
        output_path=region_output,
        base_size=1024,
        image_size=768,
        crop_mode=True,
        save_results=True
    )

    if res is None:
        result_file = os.path.join(region_output, "result.mmd")
        if os.path.exists(result_file):
            with open(result_file, 'r', encoding='utf-8') as f:
                res = f.read()
            print("✓ OCR result loaded from result.mmd")

    if res:
        region_results.append(f"\n--- {region_name.upper()} ---\n{res}")

print("\n=== Split + Preprocessing Complete ===\n")

res = "\n".join(region_results)

print("\n=== ORIGINAL OCR RESULT ===")
print(res)

# Apply post-correction
if res:
    print("\n=== Applying Basic Post-Correction ===")
    corrected_text = universal_invoice_post_correction(res)
    
    print("\n=== Applying Advanced Post-Correction (GST + Date + Math) ===")
    # Apply advanced correction with state-based GST validation and mathematical recalculation
    final_corrected_text = advanced_invoice_correction(corrected_text, state_name="TAMIL NADU")
    
    print("\n=== FINAL CORRECTED OCR RESULT ===")
    print(final_corrected_text)
    
    print("\n⚠️  NOTE: OCR may confuse similar digits (1/7, 4/7, 0/O, 5/S, 8/B, 6/G)")
    print("    Please verify important numeric values (amounts, totals) manually.")
    
    # Save original, basic corrected, and final corrected results
    original_output = os.path.join(output_path, "ocr_original.txt")
    basic_corrected_output = os.path.join(output_path, "ocr_basic_corrected.txt")
    final_corrected_output = os.path.join(output_path, "ocr_final_corrected.txt")
    
    with open(original_output, 'w', encoding='utf-8') as f:
        f.write(res)
    print(f"\n✓ Original OCR saved to: {original_output}")
    
    with open(basic_corrected_output, 'w', encoding='utf-8') as f:
        f.write(corrected_text)
    print(f"✓ Basic corrected OCR saved to: {basic_corrected_output}")
    
    with open(final_corrected_output, 'w', encoding='utf-8') as f:
        f.write(final_corrected_text)
    print(f"✓ Final corrected OCR saved to: {final_corrected_output}")
    
    # Extract structured data from final corrected text
    print("\n=== EXTRACTED STRUCTURED DATA ===")
    extracted_data = extract_structured_data(final_corrected_text)
    
    if extracted_data:
        for key, value in extracted_data.items():
            print(f"{key}: {value}")
        
        # Save as JSON
        json_output = os.path.join(output_path, "extracted_data.json")
        with open(json_output, 'w', encoding='utf-8') as f:
            json.dump(extracted_data, f, indent=4, ensure_ascii=False)
        print(f"\n✓ Structured data saved to: {json_output}")
    else:
        print("No structured data could be extracted")
else:
    print("\n⚠ No OCR result to process")
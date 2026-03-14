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



    print(f"Smart Sliced into {len(crops)} strips based on line spacing.")

    return crops



def clean_deepseek_output(raw_output):

    """Remove bbox markers and DeepSeek grounding tags from OCR output."""

    if not raw_output:

        return ""

    text = re.sub(r'\[\[.*?\]\]', '', raw_output)

    text = re.sub(r'<\|.*?\|>', '', text)

    return text.strip()





def smart_correct_invoice_from_file(file_path):



    """Reads OCR text from a file and sends it to the LLM."""



    if not os.path.exists(file_path):



        return json.dumps({"error": f"File not found: {file_path}"})



    with open(file_path, "r", encoding="utf-8") as f:



        text_content = f.read()



    if not text_content.strip():



        return json.dumps({"error": "File is empty"})







    system_prompt = (

        "You are an expert Invoice Parser. I will provide a text file containing Global OCR and Detailed Slices.\n"

        "RULES:\n"

        "1. MATH: Calculate Qty * Rate. Trust the math and 'Rupees in words' over raw OCR numbers if they conflict.\n"

        "2. GST: Indian GSTINs start with state codes (e.g., 33 for Tamil Nadu). Fix OCR typos in GSTINs.\n"

        "3. STRUCTURE: Extract Seller, Buyer, GSTINs, Bank Details, and Table Rows.\n"

        "RETURN ONLY JSON."

    )


    print(f"--- Starting Smart Correction using file: {file_path} ---")







    try:



        response = ollama.generate(



            model='qwen2.5:7b',



            system=system_prompt,



            prompt=f"PROCESS THIS OCR TEXT FILE CONTENT:\n{text_content}",



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



    state = ''.join(digit_map.get(ch, ch) for ch in token[0:2])



    if state in {'53', 'S3'}:



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

global_text = clean_deepseek_output(global_text_raw)



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
        clean_res = clean_deepseek_output(raw_res)



        if len(raw_res) > 5:

            # Save to file immediately

            f.write(f"--- SLICE {i} ---\n{raw_res}\n\n")

            ocr_outputs.append(clean_res)

            print(f"  ✓ Slice {i} saved to text file.")



print(f"=== All OCR text saved to: {ocr_storage_path} ===")



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



        llm_json_str = smart_correct_invoice_from_file(ocr_storage_path)



        print("\n=== SMART CORRECTED JSON ===\n")



        print(llm_json_str)







        llm_data = json.loads(llm_json_str)







        # 2. Apply Python Logic Cleanup



        cleaned_data = final_cleanup(llm_data)

        cleaned_data['Products'] = dynamic_math_audit(cleaned_data.get('Products', []))







        print("\n=== CLEANED JSON DATA (GST + AMOUNT FIXES) ===\n")



        print(json.dumps(cleaned_data, indent=2, ensure_ascii=False))







        # 3. Validate Math



        final_data = validate_json_data(json.dumps(cleaned_data))



        print("\n=== VALIDATED JSON DATA ===\n")



        print(json.dumps(final_data, indent=2, ensure_ascii=False))



    except Exception as e:



        print(f"Error: {e}")



else:



    print("LLM Correction skipped: OCR text file not found")
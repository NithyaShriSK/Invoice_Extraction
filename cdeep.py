from transformers import AutoModel, AutoTokenizer
import torch
import os
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

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

res = model.infer(
    tokenizer, 
    prompt=prompt, 
    image_file=preprocessed_image,  # Use preprocessed image
    output_path=output_path, 
    base_size=1024, 
    image_size=768, 
    crop_mode=True, 
    save_results=True
)

print("\n=== OCR RESULT ===\n")
print(res)
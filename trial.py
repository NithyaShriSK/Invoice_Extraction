import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim

def extraction_pipeline(filled_path, blank_path, output_path):
    # 1. Load using the Red Channel (Index 2)
    # This de-emphasizes the pink background and red lines immediately
    def load_red_channel(path):
        img = cv2.imread(path)
        if img is None: return None
        return img[:, :, 2]

    filled_red = load_red_channel(filled_path)
    blank_red = load_red_channel(blank_path)

    # 2. Image Registration (Alignment)
    # Ensures the filled form is perfectly aligned with the template
    orb = cv2.ORB_create(nfeatures=5000)
    kp1, des1 = orb.detectAndCompute(blank_red, None)
    kp2, des2 = orb.detectAndCompute(filled_red, None)

    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = sorted(bf.match(des1, des2), key=lambda x: x.distance)

    points_blank = np.float32([kp1[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
    points_filled = np.float32([kp2[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)

    homography, _ = cv2.findHomography(points_filled, points_blank, cv2.RANSAC)
    aligned_filled = cv2.warpPerspective(filled_red, homography, (blank_red.shape[1], blank_red.shape[0]))

    # 3. SSIM Difference Subtraction
    # This identifies handwriting by its shape/structure rather than just color
    score, diff = ssim(blank_red, aligned_filled, full=True)
    diff = (diff * 255).astype("uint8")

    # Thresholding (Inverted: ink becomes white for processing)
    thresh = cv2.threshold(diff, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

    # 4. Remove Table Lines (Crucial for OCR Accuracy)
    # We find long horizontal and vertical lines and delete them
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (50, 1))
    remove_horizontal = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel)

    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 50))
    remove_vertical = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel)

    # Subtract the lines from the handwriting
    clean = cv2.subtract(thresh, remove_horizontal)
    clean = cv2.subtract(clean, remove_vertical)

    # 5. Morphological Denoising
    # Removes small stray "salt and pepper" noise dots
    kernel = np.ones((2, 2), np.uint8)
    clean = cv2.morphologyEx(clean, cv2.MORPH_OPEN, kernel)

    # 6. Final Invert
    # Result: Black handwriting on a pure white background
    final_output = cv2.bitwise_not(clean)

    cv2.imwrite(output_path, final_output)
    print(f"Success! Cleaned image saved as: {output_path}")

# Run the pipeline
# Use 'invoice1.png' and your blank 'template.png'
extraction_pipeline('invoice1.png', 'template.png', 'final_high_accuracy.png')
import numpy as np
from PIL import Image

def process_logo(input_path, output_path):
    print(f"Processing {input_path} -> {output_path}")

    img = Image.open(input_path).convert("RGBA")

    # Convert to numpy array for faster processing
    data = np.array(img)

    # Extract RGB channels
    r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]

    # Identify "white-ish" pixels: R > 200 AND G > 200 AND B > 200
    white_mask = (r > 200) & (g > 200) & (b > 200)

    # Apply changes

    # 1. Set white-ish pixels to Transparent (255, 255, 255, 0)
    data[white_mask] = [255, 255, 255, 0]

    # 2. For non-white pixels, set RGB to White (255, 255, 255) and preserve Alpha
    non_white_mask = ~white_mask

    # We want to set R, G, B to 255 for these pixels.
    # Slicing the last dimension (channels)
    data[non_white_mask, 0:3] = [255, 255, 255]

    # Create image from modified array
    result_img = Image.fromarray(data)
    result_img.save(output_path, "PNG")
    print(f"Saved to {output_path}")

try:
    process_logo("/Users/manujawahar/workspace/ACID/LOGO/Soteria.png", "/Users/manujawahar/workspace/ACID/frontend/public/soteria-logo.png")
    process_logo("/Users/manujawahar/workspace/ACID/LOGO/fullLOGO.png", "/Users/manujawahar/workspace/ACID/frontend/public/soteria-full-logo.png")
    print("Logo processing complete.")
except Exception as e:
    print(f"Error processing logos: {e}")

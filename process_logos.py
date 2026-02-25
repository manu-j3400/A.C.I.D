from PIL import Image

def process_logo(input_path, output_path):
    print(f"Processing {input_path} -> {output_path}")
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()

    new_data = []
    for item in data:
        # Check if the pixel is close to white (allow some tolerance for anti-aliasing)
        if item[0] > 200 and item[1] > 200 and item[2] > 200:
            new_data.append((255, 255, 255, 0))  # Transparent
        else:
            # Change non-white pixels to white, preserving alpha
            new_data.append((255, 255, 255, item[3])) # White with original alpha
            # Alternatively, if we want to change black/dark to white and preserve opacity:
            # new_data.append((255, 255, 255, 255)) 

    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Saved to {output_path}")

try:
    process_logo("/Users/manujawahar/workspace/ACID/LOGO/Soteria.png", "/Users/manujawahar/workspace/ACID/frontend/public/soteria-logo.png")
    process_logo("/Users/manujawahar/workspace/ACID/LOGO/fullLOGO.png", "/Users/manujawahar/workspace/ACID/frontend/public/soteria-full-logo.png")
    print("Logo processing complete.")
except Exception as e:
    print(f"Error processing logos: {e}")

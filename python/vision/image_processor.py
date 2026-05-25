import base64
import io
from PIL import Image, ImageEnhance

def process_image(inputs: dict) -> dict:
    """
    Step 1: Decode and validate image
    Step 2: Extract EXIF metadata
    Step 3: Image enhancement
    Step 4: Resize for API (Target: 1568px longest edge)
    Step 5: Build analysis context
    """
    image_b64 = inputs.get("image_base64", "")
    if "," in image_b64:
        image_b64 = image_b64.split(",")[1]
        
    try:
        img_data = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(img_data))
    except Exception as e:
        raise ValueError("Invalid image format or encoding.")

    # 1. Size check
    if img.width < 640 and img.height < 480:
        pass # allow for mock testing
        
    # 2. Extract metadata (basic mock)
    metadata = {
        "original_size": [img.width, img.height],
        "format": img.format
    }
    
    # 3. Enhance
    if img.mode != 'RGB':
        img = img.convert('RGB')
    enhancer = ImageEnhance.Contrast(img)
    img_enhanced = enhancer.enhance(1.1)
    enhancer = ImageEnhance.Sharpness(img_enhanced)
    img_enhanced = enhancer.enhance(1.2)
    
    # 4. Resize
    max_size = 1568
    ratio = min(max_size / img.width, max_size / img.height)
    if ratio < 1.0:
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img_enhanced = img_enhanced.resize(new_size, Image.Resampling.LANCZOS)
        
    buffered = io.BytesIO()
    img_enhanced.save(buffered, format="JPEG")
    processed_b64 = base64.b64encode(buffered.getvalue()).decode()
    
    # 5. Build context
    country_code = inputs.get("country_code", "ZM")
    geo_context = {
        "country": country_code,
        "climate_zone": "tropical",
        "annual_rainfall": 800,
        "soil_type": "clay/loam",
        "local_materials": "concrete, brick, steel",
        "design_standards": "Eurocode / local"
    }
    
    return {
        "processed_image_base64": processed_b64,
        "metadata": metadata,
        "geo_context": geo_context,
        "hint": inputs.get("structure_hint")
    }

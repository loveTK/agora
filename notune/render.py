"""원본 위 계이름 오버레이. 단계 7."""
from PIL import Image, ImageDraw


def overlay(img: Image.Image, labels):
    """labels=[{"x","y","text","color"}] -> 새 이미지."""
    assert img.mode in ("RGB", "L"), img.mode
    out = img.convert("RGB")
    d = ImageDraw.Draw(out, "RGBA")
    for l in labels:
        d.text((l["x"], l["y"]), l["text"], fill=l["color"])
    return out

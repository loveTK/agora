"""검출 + 음높이 + 라벨 배치. 단계 3~7에서 채움."""
import cv2, numpy as np

# 단계 6에서 채움. 고정도(C=도).
SYLLABLES = {
    "ko": ["도", "레", "미", "파", "솔", "라", "시"],
    "en": ["C", "D", "E", "F", "G", "A", "B"],
    "it": ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"],
    "ja": ["ド", "レ", "ミ", "ファ", "ソ", "ラ", "シ"],
    "de": ["C", "D", "E", "F", "G", "A", "H"],
}


def detect_notes(img):
    """gray/BGR ndarray -> [{"x","y","pitch","clef"}]. 단계 3~5."""
    assert img.ndim in (2, 3), img.shape
    # ponytail: 골격. 단계 3(오선) → 4(머리) → 5(음높이) 순으로 채움.
    return []


def to_syllable(pitch, lang="ko"):
    """'C#4' -> '도♯'. 단계 6."""
    assert pitch[0] in "CDEFGAB" and lang in SYLLABLES, (pitch, lang)
    name = SYLLABLES[lang]["CDEFGAB".index(pitch[0])]
    acc = pitch[1:-1].replace("#", "♯").replace("b", "♭")
    return name + acc


def place_labels(notes, staff_space, position="below"):
    """[{"x","y",...}] -> [{"x","y","text","color"}]. 단계 7."""
    assert position in ("below", "above"), position
    return []

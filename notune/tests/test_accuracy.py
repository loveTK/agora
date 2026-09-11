"""채점: 음높이 ≥98%, 누락 ≤1%, 오탐 ≤0.5%. 단계 2에서 채움."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))
import cv2
from core import detect_notes

FIX = pathlib.Path(__file__).parent / "fixtures"
TOL = 4  # px. 같은 음표로 볼 최대 거리


def score(pred, truth):
    """-> (pitch_ok, missed, false_pos). 픽셀 거리로 1:1 매칭."""
    assert isinstance(pred, list) and isinstance(truth, list)
    left = list(pred)
    ok = missed = 0
    for t in truth:
        near = [p for p in left if abs(p["x"] - t["x"]) <= TOL and abs(p["y"] - t["y"]) <= TOL]
        if not near:
            missed += 1
            continue
        p = near[0]
        left.remove(p)
        ok += p["pitch"] == t["pitch"]
    return ok, missed, len(left)


def test_accuracy():
    jsons = sorted(FIX.glob("*.json"))
    if not jsons:
        return  # fixtures 없으면 통과 (단계 2에서 20장 투입)
    ok = missed = fp = total = 0
    for j in jsons:
        truth = json.loads(j.read_text())["notes"]
        img = cv2.imread(str(j.with_suffix(".png")))
        assert img is not None, j
        o, m, f = score(detect_notes(img), truth)
        ok, missed, fp, total = ok + o, missed + m, fp + f, total + len(truth)
    assert total, "정답 노트 0개"
    assert ok / total >= 0.98, f"pitch {ok}/{total}"
    assert missed / total <= 0.01, f"missed {missed}/{total}"
    assert fp / total <= 0.005, f"false_pos {fp}/{total}"


if __name__ == "__main__":
    test_accuracy()
    print("ok")

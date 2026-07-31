"""Пересборка презентации «Календарь дачника» (docs/store-assets/Календарь-дачника-презентация.pdf).

Что делает: ужимает скриншоты из screenshots-raw в img/, вшивает Nunito из ресурсов Android
в fonts.css (чтобы PDF выглядел как продукт и не зависел от интернета), печатает
presentation.html в PDF через headless Edge.

Запуск:  python docs/store-assets/presentation/build.py

Правки контента — прямо в presentation.html, потом снова этот скрипт.
Скриншоты в screenshots-raw/ под .gitignore, поэтому в репозиторий кладём уже ужатые img/.
"""
import base64
import pathlib
import subprocess
import sys
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RAW = ROOT / "docs" / "store-assets" / "screenshots-raw"
IMG = HERE / "img"
FONTS = ROOT / "android" / "app" / "src" / "main" / "res" / "font"
PDF_OUT = ROOT / "docs" / "store-assets" / "Календарь-дачника-презентация.pdf"

EDGE = pathlib.Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
TARGET_W = 520  # ширины хватает: в макете телефон занимает не больше 250 px


def rebuild_images() -> None:
    if not RAW.exists():
        print(f"[img] {RAW} нет — оставляю уже готовые {IMG}")
        return
    IMG.mkdir(parents=True, exist_ok=True)
    sources = [(p, p.stem) for p in sorted(RAW.glob("*.png"))]
    sources += [(p, "v2-" + p.stem) for p in sorted((RAW / "v2-real-account").glob("*.png"))]
    for src, name in sources:
        img = Image.open(src).convert("RGB")
        w, h = img.size
        img.resize((TARGET_W, round(h * TARGET_W / w)), Image.LANCZOS).save(
            IMG / f"{name}.jpg", "JPEG", quality=86, optimize=True
        )
    print(f"[img] готово: {len(sources)} шт.")


def rebuild_fonts() -> None:
    # fonts.css не в git: 825 КБ base64 в истории репозитория ни к чему, пересоздаётся отсюда.
    faces = []
    for weight, fname in [(400, "nunito_regular.ttf"), (600, "nunito_semibold.ttf"),
                          (700, "nunito_bold.ttf"), (800, "nunito_extrabold.ttf"),
                          (900, "nunito_black.ttf")]:
        b64 = base64.b64encode((FONTS / fname).read_bytes()).decode()
        faces.append(
            "@font-face{font-family:'Nunito';font-style:normal;font-weight:%d;"
            "src:url(data:font/ttf;base64,%s) format('truetype');}" % (weight, b64)
        )
    (HERE / "fonts.css").write_text("\n".join(faces), encoding="utf-8")
    print("[fonts] fonts.css собран")


def print_pdf() -> None:
    if not EDGE.exists():
        sys.exit(f"[pdf] не найден Edge: {EDGE}")
    url = "file:///" + str(HERE / "presentation.html").replace("\\", "/")
    subprocess.run(
        [str(EDGE), "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={PDF_OUT}", url],
        check=True, capture_output=True, timeout=180,
    )
    print(f"[pdf] {PDF_OUT.name}: {PDF_OUT.stat().st_size // 1024} КБ")


if __name__ == "__main__":
    rebuild_images()
    rebuild_fonts()
    print_pdf()

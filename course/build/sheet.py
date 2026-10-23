"""Contact sheets for review: python build/sheet.py out_prefix img1.png img2.png ... (4 per sheet, 2x2)."""
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
for k in range(0, len(files), 4):
    ims = [Image.open(f).convert("RGB") for f in files[k:k + 4]]
    w, h = 960, int(960 * ims[0].height / ims[0].width)
    sheet = Image.new("RGB", (w * 2 + 10, h * 2 + 10), "white")
    for i, im in enumerate(ims):
        sheet.paste(im.resize((w, h)), ((i % 2) * (w + 10), (i // 2) * (h + 10)))
    sheet.save(f"{out}-{k // 4 + 1}.png")
    print(f"{out}-{k // 4 + 1}.png")

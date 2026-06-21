import csv
import sys
from pathlib import Path

CHECK_UNUSED = "--check-unused" in sys.argv

if len(sys.argv) < 2:
    print()
    print("Usage:")
    print("py generate_csv.py archive/2026-08.csv")
    exit()

# ----------------------
# Path settings
# ----------------------

MASTER_CSV = Path(sys.argv[1])

ROOT = Path(__file__).resolve().parent.parent

THUMB_DIR = ROOT / "images" / "thumbnails"
ORIGINAL_DIR = ROOT / "images" / "originals"

IMPORT_DIR = Path(__file__).parent / "import"

ARTWORKS_CSV = IMPORT_DIR / "artworks.csv"
IMAGES_CSV = IMPORT_DIR / "artwork_images.csv"


# ----------------------
# Containers
# ----------------------

errors = []

seen_ids = set()
expected_images = set()

artworks_rows = []
image_rows = []

# ----------------------
# Read master.csv
# ----------------------

with open(MASTER_CSV, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)

    for row in reader:

        art_id = row["id"].strip()
        title = row["title"].strip()
        published_at = row["published_at"].strip()
        image_count = int(row["image_count"])

        # Duplicate check
        if art_id in seen_ids:
            errors.append(f"Duplicate ID: {art_id}")

        seen_ids.add(art_id)

        # Thumbnail
        thumbnail = f"{art_id}.webp"

        if not (THUMB_DIR / thumbnail).exists():
            errors.append(
                f"Thumbnail not found: {thumbnail}"
            )

        artworks_rows.append({
            "id": art_id,
            "title": title,
            "thumbnail_filename": thumbnail,
            "published_at": published_at
        })

        # Images
        for i in range(1, image_count + 1):

            filename = f"{art_id}_{i:02d}.webp"

            expected_images.add(filename)

            if not (ORIGINAL_DIR / filename).exists():
                errors.append(
                    f"Image not found: {filename}"
                )

            image_rows.append({
                "artwork_id": art_id,
                "image_filename": filename,
                "display_order": i
            })

# ----------------------
# Extra image check
# ----------------------

if CHECK_UNUSED:
    for file in ORIGINAL_DIR.glob("*.webp"):
        if file.name not in expected_images:
            errors.append(
                f"Unused image: {file.name}"
            )

# ----------------------
# Generate artworks.csv
# ----------------------

with open(
    ARTWORKS_CSV,
    "w",
    newline="",
    encoding="utf-8"
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=[
            "id",
            "title",
            "thumbnail_filename",
            "published_at"
        ]
    )

    writer.writeheader()
    writer.writerows(artworks_rows)

# ----------------------
# Generate artwork_images.csv
# ----------------------

with open(
    IMAGES_CSV,
    "w",
    newline="",
    encoding="utf-8"
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=[
            "artwork_id",
            "image_filename",
            "display_order"
        ]
    )

    writer.writeheader()
    writer.writerows(image_rows)

# ----------------------
# Statistics
# ----------------------

dates = [
    row["published_at"]
    for row in artworks_rows
]

print()
print("===== Result =====")
print(f"Artworks : {len(artworks_rows)}")
print(f"Images   : {len(image_rows)}")
print(f"First date: {min(dates)}")
print(f"Last date : {max(dates)}")

# ----------------------
# Errors
# ----------------------

if errors:

    print()
    print("===== ERRORS =====")

    for error in errors:
        print("-", error)

else:

    print()
    print("No errors.")
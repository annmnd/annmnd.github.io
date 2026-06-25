import csv
from pathlib import Path
from datetime import datetime

today = datetime.today().date()

BASE_URL = "https://annmnd.github.io"

MASTER_CSV = Path("import/annmnd - master.csv")
OUTPUT_XML = Path("../sitemap.xml")

artworks = []

with open(MASTER_CSV, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)

    for row in reader:
        artworks.append(row)

# 公開日順（古い→新しい）
artworks.sort(key=lambda x: x["published_at"])

xml = []

xml.append('<?xml version="1.0" encoding="UTF-8"?>')
xml.append(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
)

# トップページ
xml.append("""
<url>
    <loc>https://annmnd.github.io/</loc>
</url>
""")

published_count = 0

for art in artworks:
    published = datetime.strptime(
        art["published_at"],
        "%Y-%m-%d"
    ).date()

    if published > today:
        continue

    published_count += 1

    xml.append(f"""
<url>
    <loc>{BASE_URL}/?art={art["id"]}</loc>
    <lastmod>{art["published_at"]}</lastmod>
</url>
""")

xml.append("</urlset>")

with open(OUTPUT_XML, "w", encoding="utf-8") as f:
    f.write("\n".join(xml))

print(f"{published_count} published artworks written.")
print(f"{len(artworks)} artworks written.")
print(f"Output: {OUTPUT_XML}")
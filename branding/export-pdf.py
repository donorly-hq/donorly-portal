"""Export brand-guidelines.html to PDF (A4, print backgrounds)."""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
html = ROOT / "brand-guidelines.html"
pdf = ROOT / "Donorly-Brand-Guidelines.pdf"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(html.as_uri(), wait_until="networkidle")
    page.pdf(
        path=str(pdf),
        format="A4",
        print_background=True,
        margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
    )
    browser.close()

print("Wrote", pdf)

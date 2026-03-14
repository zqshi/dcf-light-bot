#!/usr/bin/env python3
"""
Visual Compare — 截图对比 stitch 参考 vs apps/web 实际页面
使用 browser-use 截图，Pillow + scikit-image 计算 SSIM 差异

Usage:
  python compare.py                # 对比所有页面
  python compare.py --page chat-main  # 对比指定页面
  python compare.py --priority P0     # 对比指定优先级
"""
import asyncio
import json
import os
import sys
import subprocess
import time
from pathlib import Path
from datetime import datetime

# -------------------------------------------------------------------
# Config
# -------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
CONFIG_PATH = SCRIPT_DIR / "config.json"
REPORTS_DIR = SCRIPT_DIR / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


# -------------------------------------------------------------------
# Screenshot via browser-use
# -------------------------------------------------------------------
async def take_screenshot(url: str, output_path: str, viewport: dict):
    """Take a screenshot of a URL using playwright directly."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("[WARN] playwright not installed, using placeholder screenshot")
        _create_placeholder(output_path, url)
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(
            viewport={"width": viewport["width"], "height": viewport["height"]}
        )
        await page.goto(url, wait_until="networkidle", timeout=15000)
        await page.wait_for_timeout(1000)  # settle animations
        await page.screenshot(path=output_path, full_page=False)
        await browser.close()


def _create_placeholder(path: str, label: str):
    """Create a placeholder image when browser is unavailable."""
    try:
        from PIL import Image, ImageDraw, ImageFont

        img = Image.new("RGB", (1440, 900), (245, 245, 247))
        draw = ImageDraw.Draw(img)
        draw.text((50, 50), f"Placeholder: {label}", fill=(100, 100, 100))
        img.save(path)
    except ImportError:
        pass


# -------------------------------------------------------------------
# SSIM comparison
# -------------------------------------------------------------------
def compute_ssim(img_path_a: str, img_path_b: str) -> float:
    """Compute SSIM between two images. Returns 0.0 if unable."""
    try:
        from PIL import Image
        import numpy as np
        from skimage.metrics import structural_similarity as ssim

        a = np.array(Image.open(img_path_a).convert("RGB").resize((1440, 900)))
        b = np.array(Image.open(img_path_b).convert("RGB").resize((1440, 900)))
        score = ssim(a, b, channel_axis=2)
        return round(score, 4)
    except ImportError:
        print("[WARN] scikit-image or Pillow not installed, returning 0")
        return 0.0
    except Exception as e:
        print(f"[ERROR] SSIM computation failed: {e}")
        return 0.0


def create_diff_image(img_a: str, img_b: str, output: str):
    """Create a visual diff highlighting differences."""
    try:
        from PIL import Image, ImageChops
        import numpy as np

        a = Image.open(img_a).convert("RGB").resize((1440, 900))
        b = Image.open(img_b).convert("RGB").resize((1440, 900))
        diff = ImageChops.difference(a, b)
        # Amplify differences
        arr = np.array(diff)
        arr = np.clip(arr * 5, 0, 255).astype(np.uint8)
        Image.fromarray(arr).save(output)
    except Exception:
        pass


# -------------------------------------------------------------------
# Report generation
# -------------------------------------------------------------------
def generate_html_report(results: list, output_path: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rows = ""
    for r in results:
        status = "✅" if r["ssim"] >= 0.90 else "⚠️" if r["ssim"] >= 0.70 else "❌"
        rows += f"""
        <tr>
            <td>{r["name"]}</td>
            <td>{r["priority"]}</td>
            <td>{status} {r["ssim"]:.4f}</td>
            <td><img src="{r.get('ref_img', '')}" style="max-width:400px"></td>
            <td><img src="{r.get('actual_img', '')}" style="max-width:400px"></td>
            <td><img src="{r.get('diff_img', '')}" style="max-width:400px"></td>
        </tr>
        """

    html = f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>DCF Visual Compare Report</title>
<style>
body {{ font-family: Inter, sans-serif; margin: 24px; background: #f5f5f7; }}
h1 {{ color: #1d1d1f; }}
table {{ border-collapse: collapse; width: 100%; background: white; border-radius: 12px; overflow: hidden; }}
th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.08); }}
th {{ background: #007AFF; color: white; font-size: 13px; }}
td {{ font-size: 13px; }}
img {{ border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); }}
</style>
</head><body>
<h1>DCF Visual Compare Report</h1>
<p style="color:#86868b">Generated: {timestamp}</p>
<table>
<tr><th>Page</th><th>Priority</th><th>SSIM</th><th>Reference</th><th>Actual</th><th>Diff</th></tr>
{rows}
</table>
</body></html>"""

    with open(output_path, "w") as f:
        f.write(html)
    print(f"\n📄 Report saved: {output_path}")


# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------
async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Visual compare stitch vs apps/web")
    parser.add_argument("--page", help="Compare specific page name")
    parser.add_argument("--priority", help="Compare specific priority (P0/P1/P2)")
    args = parser.parse_args()

    config = load_config()
    pages = config["pages"]
    viewport = config["viewport"]

    if args.page:
        pages = [p for p in pages if p["name"] == args.page]
    if args.priority:
        pages = [p for p in pages if p["priority"] == args.priority]

    if not pages:
        print("No pages to compare")
        return

    results = []

    for page in pages:
        print(f"\n🔍 Comparing: {page['name']} ({page['priority']})")

        ref_path = str(REPORTS_DIR / f"ref_{page['name']}.png")
        actual_path = str(REPORTS_DIR / f"actual_{page['name']}.png")
        diff_path = str(REPORTS_DIR / f"diff_{page['name']}.png")

        # Screenshot stitch reference
        if page.get("stitch_path"):
            stitch_url = f"http://127.0.0.1:{config['stitch_serve_port']}/{page['stitch_path']}"
            print(f"  📸 Reference: {stitch_url}")
            await take_screenshot(stitch_url, ref_path, viewport)
        else:
            _create_placeholder(ref_path, f"No stitch ref: {page['name']}")

        # Screenshot actual app
        actual_url = config["app_url"]
        print(f"  📸 Actual: {actual_url}")
        await take_screenshot(actual_url, actual_path, viewport)

        # Compute SSIM
        ssim_score = compute_ssim(ref_path, actual_path)
        print(f"  📊 SSIM: {ssim_score}")

        # Create diff
        create_diff_image(ref_path, actual_path, diff_path)

        results.append({
            "name": page["name"],
            "priority": page["priority"],
            "ssim": ssim_score,
            "ref_img": f"ref_{page['name']}.png",
            "actual_img": f"actual_{page['name']}.png",
            "diff_img": f"diff_{page['name']}.png",
        })

    # Generate report
    report_path = str(REPORTS_DIR / "report.html")
    generate_html_report(results, report_path)

    # Summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    for r in results:
        status = "PASS" if r["ssim"] >= 0.90 else "WARN" if r["ssim"] >= 0.70 else "FAIL"
        print(f"  [{status}] {r['name']:20s} SSIM={r['ssim']:.4f}")


if __name__ == "__main__":
    asyncio.run(main())

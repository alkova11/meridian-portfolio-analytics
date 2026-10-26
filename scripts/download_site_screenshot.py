"""Save the native Sites screenshot supplied at publication; URL is read privately."""

import getpass
import io
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

import certifi
from PIL import Image

url = getpass.getpass("Native screenshot URL (input hidden): ")
parsed = urllib.parse.urlsplit(url)
if parsed.scheme != "https" or not parsed.hostname or not parsed.hostname.endswith(".oaiusercontent.com"):
    raise ValueError("Expected the native Sites image host")
with urllib.request.urlopen(
    url, timeout=45, context=ssl.create_default_context(cafile=certifi.where())
) as response:
    data = response.read(20_000_001)
if len(data) > 20_000_000:
    raise ValueError("Screenshot exceeds 20 MB")
output = Path(__file__).resolve().parents[1] / "reports/figures/dashboard-live.png"
# Preserve the native screenshot pixels; only convert the image container to PNG.
with Image.open(io.BytesIO(data)) as screenshot:
    screenshot.convert("RGB").save(output, "PNG")
print("Saved reports/figures/dashboard-live.png")

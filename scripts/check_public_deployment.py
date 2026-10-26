"""Check the deployed public assets without cookies or authentication."""

import json
import ssl
import urllib.request

import certifi

ORIGIN = "https://meridian-portfolio-analytics-alkova11.adeptrhea24.chatgpt.site"
for path in ["/", "/demo-bootstrap.json", "/python-worker.mjs", "/project-overview.png"]:
    with urllib.request.urlopen(
        ORIGIN + path, timeout=45, context=ssl.create_default_context(cafile=certifi.where())
    ) as response:
        assert response.status == 200
        assert response.url.startswith(ORIGIN), response.url
        if path.endswith(".json"):
            data = json.load(response)
            assert data["overview"]["synthetic"]
            assert data["simulation"]["result"]["paths"] == 10000
        elif path.endswith(".png"):
            assert response.read(8) == b"\x89PNG\r\n\x1a\n"
        else:
            text = response.read().decode()
            assert "Meridian" in text if path == "/" else "initializePython" in text
        print(f"Public anonymous GET {path}: 200 OK ({response.headers.get('Content-Type')})")

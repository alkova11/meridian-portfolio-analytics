"""Read bounded chunks from the allowlisted publication ZIP for connected uploads."""

import base64
import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZipFile

bundle = Path(__file__).resolve().parents[1] / "reports/publication/meridian-portfolio-analytics-source.zip"
with ZipFile(bundle) as archive:
    if len(sys.argv) == 1:
        print(
            json.dumps(
                [
                    {
                        "path": i.filename,
                        "size": i.file_size,
                        "binary": i.filename.endswith(".png"),
                        "git_sha": hashlib.sha1(
                            b"blob " + str(i.file_size).encode() + b"\0" + archive.read(i.filename)
                        ).hexdigest(),
                    }
                    for i in archive.infolist()
                ]
            )
        )
    else:
        name, offset = sys.argv[1], int(sys.argv[2])
        raw = archive.read(name)
        content = base64.b64encode(raw).decode() if name.endswith(".png") else raw.decode("utf-8")
        print(json.dumps({"chunk": content[offset : offset + 4096], "length": len(content)}))

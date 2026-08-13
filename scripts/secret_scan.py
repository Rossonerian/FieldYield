"""Small dependency-free tracked-file secret scanner for local checks and CI."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "GitHub token": re.compile(r"\bgh[opsu]_[A-Za-z0-9]{30,}\b"),
    "Slack token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
    "Stripe live key": re.compile(r"\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    "Supabase service key": re.compile(r"\beyJ[A-Za-z0-9_-]{80,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\b"),
}
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".db", ".sqlite3"}


def main() -> int:
    result = subprocess.run(
        ["git", "ls-files", "-co", "--exclude-standard"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    findings: list[str] = []
    for relative in result.stdout.splitlines():
        path = ROOT / relative
        if not path.is_file() or path.suffix.lower() in SKIP_SUFFIXES:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for label, pattern in PATTERNS.items():
            for match in pattern.finditer(content):
                line = content.count("\n", 0, match.start()) + 1
                findings.append(f"{relative}:{line}: possible {label}")
    if findings:
        print("\n".join(findings))
        return 1
    print("Secret scan passed for tracked and unignored source files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

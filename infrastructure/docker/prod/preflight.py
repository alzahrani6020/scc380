#!/usr/bin/env python3
"""No-network, fail-closed settings preflight for customer-owned installation."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
import re
import sys

source = Path(__file__).resolve().parent / ".env"
if not source.is_file():
    sys.exit("FAIL: create a private .env from .env.example")
settings = {}
for raw in source.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    if "=" not in line:
        sys.exit("FAIL: malformed assignment")
    k, v = line.split("=", 1)
    settings[k] = v.strip().strip('"').strip("'")
required = ["POSTGRES_PASSWORD", "DATABASE_URL", "DIRECT_URL", "JWT_SECRET", "SCC380_ACTIVITY_OWNER_EMAIL", "CORS_ORIGINS"]
if any(not settings.get(k) for k in required):
    sys.exit("FAIL: missing required configuration")
if any("REPLACE_" in settings[k] for k in required):
    sys.exit("FAIL: change all template placeholders")
if len(settings["JWT_SECRET"]) < 32 or len(settings["POSTGRES_PASSWORD"]) < 20:
    sys.exit("FAIL: weak JWT or PostgreSQL secret")
for key in ("DATABASE_URL", "DIRECT_URL"):
    try:
        url = urlsplit(settings[key])
        if url.scheme not in ("postgresql", "postgres") or url.hostname != "postgres" or url.username != "scc" or url.path != "/scc_main":
            sys.exit("FAIL: database URL must target isolated customer postgres container")
        if unquote(url.password or "") != settings["POSTGRES_PASSWORD"]:
            sys.exit("FAIL: database URL password mismatch")
    except ValueError:
        sys.exit("FAIL: malformed database URL")
if not re.fullmatch(r"https://[^/,\s]+", settings["CORS_ORIGINS"]):
    sys.exit("FAIL: CORS_ORIGINS must be one HTTPS origin")
if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", settings["SCC380_ACTIVITY_OWNER_EMAIL"]):
    sys.exit("FAIL: invalid owner email")
if not settings.get("SCC_HTTP_PORT", "3000").isdigit():
    sys.exit("FAIL: invalid local Web port")
print("PASS: static customer installation configuration (no runtime tests)")

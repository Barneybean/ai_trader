#!/usr/bin/env python3
"""Channel transcript exports via the local YouTube Transcriber service.

Wraps the transcriber's REST API (github.com/Barneybean/youtube-transcriber,
localhost:19720) so the desk can pull followed-channel transcripts into the
service's export folder (its YTT_EXPORT_ROOT — keep it outside this repo)
without leaving the terminal. Mining protocol: skills/edge/channel-mining.md.

    python3 scripts/ops/transcribe_channel.py start <channel-or-video-url> [--year 2026]
    python3 scripts/ops/transcribe_channel.py status          # current/last batch
    python3 scripts/ops/transcribe_channel.py watch           # poll until done
    python3 scripts/ops/transcribe_channel.py video <url> [--lang zh-Hans,en]

If the service is down, start it first:
    cd /path/to/youtube-transcriber && npm run dev
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

_SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(_SCRIPTS, d) for d in ("lib", "ops")]

BASE = os.environ.get("YTT_BASE_URL", "http://127.0.0.1:19720")
START_HINT = ("Transcriber service is not running. Start it with:\n"
              "  cd /path/to/youtube-transcriber && npm run dev\n"
              "(github.com/Barneybean/youtube-transcriber — see its README for setup)")


def _request(path, payload=None, timeout=30):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Content-Type": "application/json"} if payload is not None else {},
        method="POST" if payload is not None else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        try:
            detail = json.load(e).get("error", "")
        except Exception:
            detail = ""
        raise SystemExit(f"HTTP {e.code} on {path}: {detail or e.reason}")
    except (urllib.error.URLError, ConnectionError):
        raise SystemExit(START_HINT)


def _print_job(job):
    if not job:
        print("No export job found (none started since the service came up).")
        return
    print(f"{job.get('phase', '?').upper()}  {job.get('url', '')}")
    print(f"  {job.get('completed', 0)}/{job.get('total', 0)} done — "
          f"{job.get('saved', 0)} saved, {job.get('skipped', 0)} skipped, "
          f"{job.get('failed', 0)} failed ({job.get('progress', 0)}%)")
    if job.get("statusText"):
        print(f"  {job['statusText']}")


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__.strip())
        return 0
    cmd, rest = args[0], args[1:]

    if cmd == "start":
        if not rest:
            raise SystemExit("Usage: transcribe_channel.py start <url> [--year YYYY]")
        payload = {"url": rest[0]}
        if "--year" in rest:
            payload["year"] = int(rest[rest.index("--year") + 1])
        job = _request("/api/export", payload).get("job")
        print("Export started.")
        _print_job(job)
        print("Track with: transcribe_channel.py watch")
        return 0

    if cmd == "status":
        _print_job(_request("/api/export").get("job"))
        return 0

    if cmd == "watch":
        while True:
            job = _request("/api/export").get("job")
            _print_job(job)
            if not job or job.get("phase") in ("completed", "failed", "cancelled"):
                return 0 if (job or {}).get("phase") == "completed" else 1
            time.sleep(30)

    if cmd == "video":
        if not rest:
            raise SystemExit("Usage: transcribe_channel.py video <url> [--lang codes]")
        payload = {"url": rest[0]}
        if "--lang" in rest:
            payload["lang"] = rest[rest.index("--lang") + 1]
        result = _request("/api/transcripts", payload, timeout=900)
        dup = " (already in library)" if result.get("duplicate") else ""
        if result.get("proofreadNotice"):
            print(result["proofreadNotice"])
        print(f"Transcribed{dup}: {result.get('title') or rest[0]}")
        print(f"  source: {result.get('source', '?')} — "
              f"{len(result.get('transcript') or '')} chars, id {result.get('id', '?')}")
        return 0

    raise SystemExit(f"Unknown command '{cmd}'. Commands: start, status, watch, video")


if __name__ == "__main__":
    import desk_log
    sys.exit(desk_log.run(main))

#!/usr/bin/env python
"""HomeCartel Marketing Output UI — Cloudflare Quick Tunnel Launcher.

Exposes the local Next.js Content Calendar application (http://localhost:3000)
to the internet via a free, secure Cloudflare Quick Tunnel (https://*.trycloudflare.com).

Zero configuration required. Coworkers can immediately access the live
calendar and generated marketing assets from any browser or device.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request

WORKSPACE_DIR = Path(__file__).resolve().parent
EXTERNAL_AUTOMATION_DIR = Path(r"C:\Users\User\marketing-automation")
LOCAL_TOOLS_DIR = WORKSPACE_DIR / "tools"
LOCAL_CLOUDFLARED = LOCAL_TOOLS_DIR / "cloudflared.exe"
EXTERNAL_CLOUDFLARED = EXTERNAL_AUTOMATION_DIR / "tools" / "cloudflared.exe"
TUNNEL_URL_FILE = WORKSPACE_DIR / ".cloudflare_url.txt"

# Regex to capture Cloudflare quick tunnel URL
TUNNEL_REGEX = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")


def is_server_healthy(port: int = 3000, timeout: float = 2.0) -> bool:
    """Check if the Next.js server is answering on the local port."""
    url = f"http://127.0.0.1:{port}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "HC-Tunnel-Checker"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status in (200, 304, 307, 308)
    except Exception:
        return False


def copy_to_clipboard(text: str) -> bool:
    """Attempt to copy text to Windows clipboard."""
    try:
        if sys.platform == "win32":
            p = subprocess.Popen(["clip"], stdin=subprocess.PIPE, shell=True)
            p.communicate(input=text.encode("utf-8"))
            return p.returncode == 0
    except Exception:
        pass
    return False


def ensure_cloudflared_binary() -> Path:
    """Locate or download the official cloudflared binary."""
    # 1. Check existing binary in marketing-automation tools
    if EXTERNAL_CLOUDFLARED.exists():
        return EXTERNAL_CLOUDFLARED

    # 2. Check local tools/ directory
    if LOCAL_CLOUDFLARED.exists():
        return LOCAL_CLOUDFLARED

    # 3. Check system PATH
    system_path = shutil.which("cloudflared")
    if system_path:
        return Path(system_path)

    # 4. Auto-download from Cloudflare official GitHub releases
    LOCAL_TOOLS_DIR.mkdir(parents=True, exist_ok=True)
    download_url = (
        "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    )
    print(f"[*] cloudflared not found. Downloading official binary from:\n    {download_url}")
    print("[*] Downloading to tools/cloudflared.exe (this takes ~10 seconds)...")

    urllib.request.urlretrieve(download_url, LOCAL_CLOUDFLARED)
    print("[+] Download complete!")
    return LOCAL_CLOUDFLARED


def start_nextjs_server(port: int = 3000, prod: bool = False) -> subprocess.Popen:
    """Spawn Next.js dev or production server."""
    # Detect pnpm or npm
    pnpm_cmd = shutil.which("pnpm.cmd") or shutil.which("pnpm")
    npm_cmd = shutil.which("npm.cmd") or shutil.which("npm")

    if pnpm_cmd:
        runner = [pnpm_cmd, "run", "start" if prod else "dev"]
    elif npm_cmd:
        runner = [npm_cmd, "run", "start" if prod else "dev"]
    else:
        runner = ["npx", "next", "start" if prod else "dev"]

    if port != 3000:
        runner.extend(["-p", str(port)])

    creation_flags = 0
    if sys.platform == "win32":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

    proc = subprocess.Popen(
        runner,
        cwd=str(WORKSPACE_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creation_flags,
    )
    return proc


def main():
    parser = argparse.ArgumentParser(description="Launch HomeCartel Marketing Output UI Cloudflare Tunnel")
    parser.add_argument("--port", type=int, default=3000, help="Local Next.js port (default: 3000)")
    parser.add_argument("--no-copy", action="store_true", help="Do not copy URL to clipboard")
    parser.add_argument("--prod", action="store_true", help="Run production server instead of dev server")
    parser.add_argument("--test-only", action="store_true", help="Verify tunnel connection and exit after 5s")
    args = parser.parse_args()

    port = args.port
    cloudflared_bin = ensure_cloudflared_binary()

    server_proc: subprocess.Popen | None = None

    print("=" * 76)
    print("   HOMECARTEL MARKETING OUTPUT UI -- CLOUDFLARE QUICK TUNNEL")
    print("=" * 76)

    # Step 1: Ensure Next.js Server is active
    if is_server_healthy(port):
        print(f"[+] Local Next.js server is already active on port {port}.")
    else:
        mode_str = "production" if args.prod else "development"
        print(f"[*] Starting local Next.js server ({mode_str}) on port {port}...")
        server_proc = start_nextjs_server(port, args.prod)

        # Wait up to 30 seconds for server to answer
        started = False
        for _ in range(60):
            time.sleep(0.5)
            if is_server_healthy(port):
                started = True
                break

        if not started:
            print(f"[!] Warning: Local server didn't respond on port {port} within 30s. Proceeding anyway.")
        else:
            print(f"[+] Local Next.js server started successfully (PID {server_proc.pid}).")

    # Step 2: Spawn cloudflared tunnel
    tunnel_cmd = [str(cloudflared_bin), "tunnel", "--url", f"http://127.0.0.1:{port}"]
    print(f"[*] Starting Cloudflare Quick Tunnel pointing to http://127.0.0.1:{port}...")

    creation_flags = 0
    if sys.platform == "win32":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

    tunnel_proc = subprocess.Popen(
        tunnel_cmd,
        cwd=str(WORKSPACE_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        creationflags=creation_flags,
    )

    public_url: str | None = None
    log_lines: list[str] = []

    print("[*] Waiting for Cloudflare assigned public URL...")

    start_time = time.time()
    while time.time() - start_time < 35:
        if tunnel_proc.poll() is not None:
            err_output = tunnel_proc.stderr.read() if tunnel_proc.stderr else ""
            print(f"[!] cloudflared exited unexpectedly:\n{err_output}")
            sys.exit(1)

        line = tunnel_proc.stderr.readline() if tunnel_proc.stderr else ""
        if line:
            log_lines.append(line)
            match = TUNNEL_REGEX.search(line)
            if match:
                public_url = match.group(0)
                break
        time.sleep(0.1)

    if not public_url:
        print("[!] Timed out waiting for Cloudflare tunnel URL. Recent logs:")
        for l in log_lines[-10:]:
            print("   ", l.strip())
        tunnel_proc.terminate()
        sys.exit(1)

    # Save to file for external checks
    try:
        TUNNEL_URL_FILE.write_text(public_url, encoding="utf-8")
    except Exception:
        pass

    # Copy to clipboard if requested
    copied = False
    if not args.no_copy:
        copied = copy_to_clipboard(public_url)

    # Step 3: Print Friendly Banner
    print("\n" + "=" * 76)
    print("  SUCCESS! YOUR MARKETING OUTPUT UI IS LIVE ON THE INTERNET")
    print("=" * 76)
    print(f"\n  >> Public HTTPS Link : {public_url}")
    if copied:
        print("     [Copied to clipboard! Ready to paste into Slack / Teams / Browser]")
    print(f"  >> Local Port        : http://localhost:{port}")
    print("  >> Security Access   : Open Access (No PIN required)")
    print("\n  Coworker Access:")
    print("  - Anyone with this link can view the Content Calendar (Months & Days).")
    print("  - Coworkers can inspect scheduled Feeds, Reels, and Stories.")
    print("  - Generated assets and previews are served seamlessly via the tunnel.")
    print("\n" + "-" * 76)
    print("  Keep this terminal open while coworkers are using the UI.")
    print("  Press Ctrl + C at any time to shut down the public tunnel.")
    print("=" * 76 + "\n")

    if args.test_only:
        print("[*] Test mode active: Tunnel will shut down after 5 seconds.")
        time.sleep(5)
        cleanup(tunnel_proc, server_proc)
        return

    # Keep alive until user exits
    try:
        while True:
            time.sleep(1)
            if tunnel_proc.poll() is not None:
                print("\n[!] Cloudflare tunnel connection closed.")
                break
    except KeyboardInterrupt:
        print("\n\n[*] Shutting down Cloudflare tunnel...")
    finally:
        cleanup(tunnel_proc, server_proc)


def cleanup(tunnel_proc: subprocess.Popen, server_proc: subprocess.Popen | None):
    """Clean up running subprocesses and temporary files."""
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(tunnel_proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            tunnel_proc.terminate()
            tunnel_proc.wait(timeout=3)
    except Exception:
        pass

    if server_proc is not None:
        print("[*] Stopping local Next.js server spawned by launcher...")
        try:
            if sys.platform == "win32":
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(server_proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                server_proc.terminate()
                server_proc.wait(timeout=3)
        except Exception:
            pass

    if TUNNEL_URL_FILE.exists():
        try:
            TUNNEL_URL_FILE.unlink()
        except Exception:
            pass

    print("[+] Cleanup complete. Public tunnel is closed.")


if __name__ == "__main__":
    main()

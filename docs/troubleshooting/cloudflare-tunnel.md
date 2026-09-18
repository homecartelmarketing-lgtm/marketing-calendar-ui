# Troubleshooting: Cloudflare Tunnel & Local Proxy

#troubleshooting #cloudflare #tunnel #networking

This playbook details running the local Next.js server behind a Cloudflare Tunnel for webhook reception and mobile device preview.

---

## 🛠️ Launch Scripts & Components

* **Python Launcher**: [`launch_ui_cloudflare.py`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/launch_ui_cloudflare.py)
* **Windows Batch Launcher**: [`launch_ui_cloudflare.bat`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/launch_ui_cloudflare.bat)
* **Full Setup Guide**: [`CLOUDFLARE_TUNNEL_GUIDE.md`](file:///c:/Users/User/Downloads/Marketing%20Output%20UI/CLOUDFLARE_TUNNEL_GUIDE.md)

---

## 🚨 Common Pitfalls

### 1. Tunnel URL Disconnected / 502 Bad Gateway
* **Symptom**: Accessing the public Cloudflare URL returns `502 Bad Gateway`.
* **Root Cause**: The Next.js dev server on `http://localhost:3000` crashed, stopped, or is taking too long to compile.
* **Solution**:
  1. Check terminal running `npm run dev` to ensure Next.js is actively listening on port 3000.
  2. Verify `.cloudflare_url.txt` contains the active tunnel URL.
  3. Restart using `launch_ui_cloudflare.bat`.

### 2. Tunnel Token Configuration
* **Symptom**: `cloudflared error: cannot authenticate with token`.
* **Root Cause**: Missing or malformed `CLOUDFLARE_TUNNEL_TOKEN` in `.env.local`.
* **Solution**:
  1. Retrieve tunnel token from Cloudflare Zero Trust dashboard.
  2. Ensure token is copied without trailing spaces into `.env.local`.

---

## 🔗 Related Notes
- [[architecture/system-blueprint|System Blueprint]]

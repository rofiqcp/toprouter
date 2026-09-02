#!/usr/bin/env python3
"""
kie.py — client untuk kie.ai (https://kie.ai) Market image models.

Mendukung model image-to-image / text-to-image, termasuk:
  - seedream/5-pro-image-to-image   (butuh input image)
  - nano-banana-2                    (text-to-image, optional input image)

ALUR (unified Market API):
  1. (khusus butuh input image) Upload gambar -> kieai.redpandaai.co
     -> dapat fileUrl
  2. POST https://api.kie.ai/api/v1/jobs/createTask  {model, input}
     -> dapat taskId
  3. GET  https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...
     poll sampai state=="success" -> resultJson: {"resultUrls":[...]}
  4. Download hasil.

Key diambil dari env var KIE_API_KEY (jangan hardcode).
Cara pakai:
  export KIE_API_KEY="4d496c81...."
  python3 kie.py --model nano-banana-2 --prompt "a cat" --out cat.jpg
  python3 kie.py --model seedream/5-pro-image-to-image --prompt "..." --image in.png --out out.png
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API_BASE = "https://api.kie.ai"
UPLOAD_BASE = "https://kieai.redpandaai.co"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

POLL_INTERVAL = 3.0
POLL_TIMEOUT = 600.0


def _headers(api_key: str, json_ct: bool = True) -> dict:
    h = {"Authorization": f"Bearer {api_key}", "User-Agent": UA}
    if json_ct:
        h["Content-Type"] = "application/json"
    return h


def _request(method: str, url: str, api_key: str, body=None, json_ct: bool = True):
    data = json.dumps(body).encode() if (body is not None and json_ct) else body
    req = urllib.request.Request(url, data=data,
                                 headers=_headers(api_key, json_ct), method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else {}), None
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            txt = json.loads(raw)
        except Exception:
            txt = raw
        return e.code, txt, f"HTTP {e.code}: {raw[:600]}"


# ---------- file upload (dapat URL untuk model yg butuh input image) ----------
def upload_image(api_key: str, image_path: str) -> str:
    """Upload gambar lokal ke kie.ai, kembalikan fileUrl."""
    ext = os.path.splitext(image_path)[1].lower().lstrip(".")
    mime = {"png": "image/png", "jpg": "image/jpeg",
            "jpeg": "image/jpeg", "webp": "image/webp"}.get(ext, "image/png")
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    payload = {
        "base64Data": f"data:{mime};base64,{b64}",
        "uploadPath": "images",
        "fileName": os.path.basename(image_path),
    }
    status, resp, err = _request(
        "POST", f"{UPLOAD_BASE}/api/file-base64-upload", api_key, payload)
    if err or not resp.get("success"):
        raise RuntimeError(f"Upload gagal: {err or resp}")
    # Dokumen menyebut field "fileUrl", tapi respons riil pakai "downloadUrl".
    # Ambil salah satu yang ada.
    data = resp.get("data", {})
    url = data.get("downloadUrl") or data.get("fileUrl") or data.get("url")
    if not url:
        raise RuntimeError(f"Tidak ada URL hasil upload: {resp}")
    return url


# ---------- task creation + polling ----------
def create_task(api_key: str, model: str, input_obj: dict) -> str:
    payload = {"model": model, "input": input_obj}
    status, resp, err = _request(
        "POST", f"{API_BASE}/api/v1/jobs/createTask", api_key, payload)
    if err:
        raise RuntimeError(f"Create task gagal: {err}")
    if resp.get("code") != 200:
        raise RuntimeError(f"Create task error (code={resp.get('code')}): {resp.get('msg')}")
    tid = resp.get("data", {}).get("taskId")
    if not tid:
        raise RuntimeError(f"Tidak ada taskId: {resp}")
    return tid


def get_task(api_key: str, task_id: str) -> dict:
    url = f"{API_BASE}/api/v1/jobs/recordInfo?taskId={urllib.parse.quote(task_id)}"
    status, resp, err = _request("GET", url, api_key, json_ct=False)
    if err:
        raise RuntimeError(f"Get task gagal: {err}")
    if resp.get("code") != 200:
        raise RuntimeError(f"Get task error (code={resp.get('code')}): {resp.get('msg')}")
    return resp.get("data", {})


def wait_for_result(api_key: str, task_id: str) -> list:
    """Poll sampai success. Kembalikan list of result URL."""
    waited = 0.0
    while waited <= POLL_TIMEOUT:
        data = get_task(api_key, task_id)
        state = data.get("state")
        if state == "success":
            rj = data.get("resultJson")
            if isinstance(rj, str):
                try:
                    rj = json.loads(rj)
                except Exception:
                    rj = {}
            urls = (rj or {}).get("resultUrls", [])
            if urls:
                return urls
            raise RuntimeError(f"success tapi kosong resultUrls: {data}")
        if state == "fail":
            raise RuntimeError(f"Task fail: {data.get('failMsg')} (code={data.get('failCode')})")
        time.sleep(POLL_INTERVAL)
        waited += POLL_INTERVAL
    raise RuntimeError("Timeout menunggu hasil (state belum success).")


def download(url: str, out_path: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        with open(out_path, "wb") as f:
            f.write(resp.read())


# ---------- high-level helpers per model ----------
def seedream_i2i(api_key: str, *, prompt: str, image_path: str,
                 aspect_ratio: str = "1:1", quality: str = "basic",
                 output_format: str = "png", out_path: str = "seedream_out.png") -> str:
    """Seedream 5 Pro image-to-image (wajib input image)."""
    img_url = upload_image(api_key, image_path)
    input_obj = {
        "prompt": prompt,
        "image_urls": [img_url],
        "aspect_ratio": aspect_ratio,
        "quality": quality,            # basic=1K, high=2K
        "output_format": output_format,
    }
    tid = create_task(api_key, "seedream/5-pro-image-to-image", input_obj)
    print(f"[+] seedream taskId: {tid}")
    print("[*] menunggu hasil ...")
    urls = wait_for_result(api_key, tid)
    download(urls[0], out_path)
    print(f"[+] selesai -> {out_path}")
    return out_path


def nano_banana2(api_key: str, *, prompt: str, image_path: str | None = None,
                 aspect_ratio: str = "1:1", resolution: str = "1K",
                 output_format: str = "png", out_path: str = "nanobanana_out.png") -> str:
    """Nano Banana 2 (text-to-image, input image opsional)."""
    input_obj = {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,       # 1K / 2K / 4K
        "output_format": output_format,
    }
    if image_path:
        input_obj["image_input"] = [upload_image(api_key, image_path)]
    tid = create_task(api_key, "nano-banana-2", input_obj)
    print(f"[+] nano-banana-2 taskId: {tid}")
    print("[*] menunggu hasil ...")
    urls = wait_for_result(api_key, tid)
    download(urls[0], out_path)
    print(f"[+] selesai -> {out_path}")
    return out_path


def _main():
    p = argparse.ArgumentParser(description="kie.ai image generation client")
    p.add_argument("--model", required=True,
                   choices=["seedream/5-pro-image-to-image", "nano-banana-2"],
                   help="Model yang dipakai")
    p.add_argument("--prompt", required=True, help="Prompt teks")
    p.add_argument("--image", default=None,
                   help="Path gambar input (wajib untuk seedream i2i)")
    p.add_argument("--aspect-ratio", default="1:1")
    p.add_argument("--quality", default="basic",
                   help="seedream: basic(1K) / high(2K)")
    p.add_argument("--resolution", default="1K",
                   help="nano-banana-2: 1K / 2K / 4K")
    p.add_argument("--output-format", default="png",
                   help="png / jpeg / jpg")
    p.add_argument("--out", default="kie_out.png")
    p.add_argument("--key", default=None, help="Override KIE_API_KEY")
    args = p.parse_args()

    api_key = args.key or os.environ.get("KIE_API_KEY")
    if not api_key:
        sys.exit("ERROR: set env KIE_API_KEY atau pakai --key.")

    try:
        if args.model == "seedream/5-pro-image-to-image":
            if not args.image:
                sys.exit("ERROR: seedream i2i butuh --image (input image).")
            seedream_i2i(api_key, prompt=args.prompt, image_path=args.image,
                         aspect_ratio=args.aspect_ratio, quality=args.quality,
                         output_format=args.output_format, out_path=args.out)
        else:  # nano-banana-2
            nano_banana2(api_key, prompt=args.prompt, image_path=args.image,
                         aspect_ratio=args.aspect_ratio, resolution=args.resolution,
                         output_format=args.output_format, out_path=args.out)
    except RuntimeError as e:
        sys.exit(f"GAGAL: {e}")


if __name__ == "__main__":
    _main()

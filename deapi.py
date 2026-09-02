#!/usr/bin/env python3
"""
deapi.py — client untuk deAPI (https://deapi.ai) image generation.

Mendukung model txt2img (termasuk FLUX.2 Klein 4B BF16) dan img2img.

PITFALL YANG SUDAH DISELESAIKAN:
  1. Cloudflare memblokir default Python User-Agent (error 1010).
     -> Wajib pakai User-Agent browser (sudah diset di HEADERS).
  2. FLUX.2 Klein 4B BF16 MENGUNCI steps=4 (min=max=4) dan
     TIDAK mendukung guidance / negative_prompt.
     -> enforced otomatis kalau model == Flux_2_Klein_4B_BF16.

Key diambil dari env var DEAPI_KEY (jangan hardcode).
Cara pakai:
  export DEAPI_KEY="L9yi3ybf...."
  python3 deapi.py --prompt "a cat wearing helmet" --out cat.png
  python3 deapi.py --list-models
  python3 deapi.py --prompt "..." --model Flux_2_Klein_4B_BF16 --width 1024 --height 1024
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import base64

API_BASE = "https://api.deapi.ai"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

# Model yang mengunci steps=4 dan tidak support guidance/negative_prompt
LOCKED_STEPS_4_NO_CFG = {"flux_2_klein_4b_bf16"}

# Batas resolusi aman (kelipatan 16, 256-1536 untuk Klein)
RES_STEP = 16
RES_MIN, RES_MAX = 256, 1536

POLL_INTERVAL = 3.0      # detik antar poll
POLL_TIMEOUT = 300.0     # maksimal nunggu hasil (detik)


def _headers(api_key: str) -> dict:
    return {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": UA,
    }


def _request(method: str, path: str, api_key: str, body=None):
    url = API_BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data,
                                 headers=_headers(api_key), method=method)
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
        return e.code, txt, f"HTTP {e.code}: {raw[:500]}"


def _round_res(v: int) -> int:
    v = max(RES_MIN, min(RES_MAX, v))
    return max(RES_MIN, round(v / RES_STEP) * RES_STEP)


def list_models(api_key: str) -> list:
    """Kembalikan daftar model txt2img yang tersedia."""
    status, resp, err = _request("GET", "/api/v1/client/models?per_page=200", api_key)
    if err:
        raise RuntimeError(f"Gagal mengambil model: {err}")
    return resp.get("data", [])


def get_model_slugs(api_key: str, inference_type: str = "txt2img") -> list:
    out = []
    for m in list_models(api_key):
        if inference_type in m.get("inference_types", []):
            out.append(m.get("slug"))
    return out


def submit_txt2img(api_key: str, *, prompt: str, model: str,
                   width: int = 1024, height: int = 1024,
                   steps: int = 4, guidance: float = 0.0,
                   negative_prompt: str | None = None,
                   seed: int = 0) -> str:
    """Submit job txt2img, kembalikan request_id."""
    m = model.lower()
    if m in LOCKED_STEPS_4_NO_CFG:
        steps = 4
        negative_prompt = None  # tidak didukung

    payload = {
        "prompt": prompt,
        "model": model,
        "width": _round_res(width),
        "height": _round_res(height),
        "guidance": guidance,
        "steps": steps,
        "seed": seed,
    }
    if negative_prompt:
        payload["negative_prompt"] = negative_prompt

    status, resp, err = _request("POST", "/api/v1/client/txt2img", api_key, payload)
    if err or status != 200:
        raise RuntimeError(f"Submit gagal: {err or resp}")
    rid = resp.get("data", {}).get("request_id")
    if not rid:
        raise RuntimeError(f"Tidak ada request_id: {resp}")
    return rid


def submit_img2img(api_key: str, *, prompt: str, model: str,
                    image_path: str, width: int = 1024, height: int = 1024,
                    steps: int = 4, guidance: float = 0.0,
                    seed: int = 0) -> str:
    """Submit job img2img (kirim 1 gambar base64)."""
    m = model.lower()
    if m in LOCKED_STEPS_4_NO_CFG:
        steps = 4

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    payload = {
        "prompt": prompt,
        "model": model,
        "image": b64,
        "width": _round_res(width),
        "height": _round_res(height),
        "guidance": guidance,
        "steps": steps,
        "seed": seed,
    }
    status, resp, err = _request("POST", "/api/v1/client/prompt/image2image", api_key, payload)
    if err or status != 200:
        raise RuntimeError(f"Submit img2img gagal: {err or resp}")
    rid = resp.get("data", {}).get("request_id")
    if not rid:
        raise RuntimeError(f"Tidak ada request_id: {resp}")
    return rid


def wait_for_result(api_key: str, request_id: str) -> dict:
    """Poll status sampai done/error, kembalikan dict data status akhir."""
    waited = 0.0
    while waited <= POLL_TIMEOUT:
        status, resp, err = _request(
            "GET", f"/api/v1/client/request-status/{request_id}", api_key)
        if err:
            raise RuntimeError(f"Poll gagal: {err}")
        data = resp.get("data", {})
        st = data.get("status")
        if st == "done":
            return data
        if st == "error":
            raise RuntimeError(f"Job error: {resp}")
        time.sleep(POLL_INTERVAL)
        waited += POLL_INTERVAL
    raise RuntimeError("Timeout menunggu hasil generate (status belum done).")


def download(url: str, out_path: str, api_key: str | None = None) -> str:
    """Download hasil ke file. Coba tanpa auth, kalau gagal pakai token."""
    try:
        urllib.request.urlretrieve(url, out_path)
    except Exception:
        headers = _headers(api_key) if api_key else {"User-Agent": UA}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as resp:
            with open(out_path, "wb") as f:
                f.write(resp.read())
    return out_path


def generate(api_key: str, *, prompt: str, model: str = "Flux_2_Klein_4B_BF16",
             width: int = 1024, height: int = 1024, steps: int = 4,
             guidance: float = 0.0, negative_prompt: str | None = None,
             seed: int = 0, out_path: str = "output.png",
             img2img_path: str | None = None) -> str:
    """One-shot: submit -> poll -> download. Kembalikan path file hasil."""
    if img2img_path:
        rid = submit_img2img(api_key, prompt=prompt, model=model,
                             image_path=img2img_path, width=width, height=height,
                             steps=steps, guidance=guidance, seed=seed)
    else:
        rid = submit_txt2img(api_key, prompt=prompt, model=model, width=width,
                             height=height, steps=steps, guidance=guidance,
                             negative_prompt=negative_prompt, seed=seed)

    print(f"[+] request_id: {rid}")
    print("[*] menunggu hasil generate ...")
    data = wait_for_result(api_key, rid)
    result_url = data.get("result_url")
    if not result_url:
        raise RuntimeError(f"Tidak ada result_url: {data}")

    download(result_url, out_path, api_key)
    print(f"[+] selesai -> {out_path}")
    return out_path


def _main():
    p = argparse.ArgumentParser(description="deAPI image generation client")
    p.add_argument("--prompt", help="Prompt teks untuk generasi")
    p.add_argument("--model", default="Flux_2_Klein_4B_BF16",
                   help="Slug model (default: Flux_2_Klein_4B_BF16)")
    p.add_argument("--width", type=int, default=1024)
    p.add_argument("--height", type=int, default=1024)
    p.add_argument("--steps", type=int, default=4)
    p.add_argument("--guidance", type=float, default=0.0)
    p.add_argument("--negative-prompt", default=None)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--out", default="output.png", help="Path file output")
    p.add_argument("--img2img", default=None, help="Path gambar input untuk img2img")
    p.add_argument("--list-models", action="store_true", help="Tampilkan model tersedia")
    p.add_argument("--key", default=None, help="Override DEAPI_KEY")
    args = p.parse_args()

    api_key = args.key or os.environ.get("DEAPI_KEY")
    if not api_key:
        sys.exit("ERROR: set env DEAPI_KEY atau pakai --key.")

    if args.list_models:
        print("Model txt2img tersedia:")
        for slug in get_model_slugs(api_key, "txt2img"):
            print("  -", slug)
        return

    if not args.prompt:
        sys.exit("ERROR: --prompt wajib diisi (kecuali --list-models).")

    try:
        generate(api_key, prompt=args.prompt, model=args.model,
                  width=args.width, height=args.height, steps=args.steps,
                  guidance=args.guidance, negative_prompt=args.negative_prompt,
                  seed=args.seed, out_path=args.out, img2img_path=args.img2img)
    except RuntimeError as e:
        sys.exit(f"GAGAL: {e}")


if __name__ == "__main__":
    _main()

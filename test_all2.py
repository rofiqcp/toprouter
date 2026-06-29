#!/usr/bin/env python3
import requests
import json
import sys

API_KEY = "sk-c..._URL = "http://localhost:20128"
HEADERS = {"Content-Type": "application/json", "Authorization": "Bearer " + API_KEY}

print("=== IMAGE TEST ===")
r = requests.post(BASE_URL + "/v1/images/generations", headers=HEADERS,
    json={"model": "alibaba-media/qwen-image", "prompt": "A red car on a road", "size": "1024x1024"}, timeout=180)
d = r.json()
print("Status:", r.status_code)
img_url = d.get("data", [{}])[0].get("url", "")
print("URL:", img_url[:80] if img_url else "NONE")

if img_url:
    print("\n=== IMAGE EDIT TEST ===")
    r2 = requests.post(BASE_URL + "/v1/images/edits", headers=HEADERS,
        json={"model": "alibaba-media/qwen-image-edit", "prompt": "Change the car color to blue", "image": img_url}, timeout=180)
    d2 = r2.json()
    print("Status:", r2.status_code)
    if r2.status_code == 200 and d2.get("data"):
        print("URL:", d2["data"][0].get("url", "")[:80])
    else:
        print("Response:", json.dumps(d2, indent=2)[:500])

print("\n=== VIDEO TEST ===")
r3 = requests.post(BASE_URL + "/v1/video/generations", headers=HEADERS,
    json={"model": "alibaba-media/wan2.6-t2v", "prompt": "A cat walking on grass"}, timeout=300)
d3 = r3.json()
print("Status:", r3.status_code)
if d3.get("data"):
    print("URL:", d3["data"][0].get("url", "")[:80])
else:
    print("Response:", json.dumps(d3, indent=2)[:500])

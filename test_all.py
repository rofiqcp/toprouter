import requests
import json
import sys

API_KEY = "***    BASE_URL = "http://localhost:20128"
HEADERS = {"Content-Type": "application/json", "Authorization": "Bearer " + API_KEY}

# First generate image for edit test
r = requests.post(BASE_URL + "/v1/images/generations", headers=HEADERS,
    json={"model": "alibaba-media/qwen-image", "prompt": "A red car on a road", "size": "1024x1024"}, timeout=180)
print("IMAGE:", r.status_code)
d = r.json()
img_url = d.get("data", [{}])[0].get("url", "")
print("IMGURL:", img_url[:80] if img_url else "NONE")

if img_url:
    r2 = requests.post(BASE_URL + "/v1/images/edits", headers=HEADERS,
        json={"model": "alibaba-media/qwen-image-edit", "prompt": "Change car color to blue", "image": img_url}, timeout=180)
    print("EDIT:", r2.status_code)
    d2 = r2.json()
    print(json.dumps(d2, indent=2)[:500])

# Video test
r3 = requests.post(BASE_URL + "/v1/video/generations", headers=HEADERS,
    json={"model": "alibaba-media/wan2.6-t2v", "prompt": "A cat walking on grass"}, timeout=300)
print("VIDEO:", r3.status_code)
d3 = r3.json()
if d3.get("data"):
    print("VIDEO URL:", d3["data"][0].get("url", "")[:80])
else:
    print(json.dumps(d3, indent=2)[:500])

import requests
import json
import sys

API_KEY="sk-c...    "http://localhost:20128"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-c...
}

print("=" * 60)
print("Testing Alibaba Media Provider - Full")
print("=" * 60)

# First generate an image to use for edit test
img_url = None
print("\n1. IMAGE TEST: qwen-image")
try:
    r = requests.post(
        BASE_URL + "/v1/images/generations",
        headers=headers,
        json={"model": "alibaba-media/qwen-image", "prompt": "A red car on a road", "size": "1024x1024"},
        timeout=180
    )
    print(f"Status: {r.status_code}")
    data = r.json()
    if r.status_code == 200:
        print("PASS")
        img_url = data['data'][0].get('url', '')
        print(f"  URL: {img_url[:80]}...")
    else:
        print(f"FAIL: {json.dumps(data, indent=2)[:300]}")
except Exception as e:
    print(f"Error: {e}")

# Test 2: Image Edit with the generated image URL
print("\n2. IMAGE EDIT TEST: qwen-image-edit")
if img_url:
    try:
        r = requests.post(
            BASE_URL + "/v1/images/edits",
            headers=headers,
            json={
                "model": "alibaba-media/qwen-image-edit",
                "prompt": "Change the car color to blue",
                "image": img_url
            },
            timeout=180
        )
        print(f"Status: {r.status_code}")
        data = r.json()
        if r.status_code == 200:
            print("PASS")
            if data.get("data"):
                print(f"  URL: {data['data'][0].get('url', 'N/A')[:80]}...")
        else:
            print(f"FAIL: {json.dumps(data, indent=2)[:300]}")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("SKIP - no source image")

# Test 3: Video Generation
print("\n3. VIDEO TEST: wan2.6-t2v")
try:
    r = requests.post(
        BASE_URL + "/v1/video/generations",
        headers=headers,
        json={"model": "alibaba-media/wan2.6-t2v", "prompt": "A cat walking on grass"},
        timeout=300
    )
    print(f"Status: {r.status_code}")
    data = r.json()
    if r.status_code == 200:
        print("PASS")
        if data.get("data"):
            print(f"  URL: {data['data'][0].get('url', 'N/A')[:80]}...")
    else:
        print(f"FAIL: {json.dumps(data, indent=2)[:300]}")
except requests.exceptions.Timeout:
    print("TIMEOUT")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 60)
print("Done")
print("=" * 60)
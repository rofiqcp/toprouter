import requests
import json
import sys

API_KEY = "sk-ccfa926bc01cfa19-j800gj-d8a3b6f0"
BASE_URL = "http://localhost:20128"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}

print("=" * 60)
print("Testing Alibaba Media Provider - Comprehensive")
print("=" * 60)

# Test 1: Image Generation
print("\n1. IMAGE TEST: qwen-image")
try:
    r = requests.post(
        f"{BASE_URL}/v1/images/generations",
        headers=headers,
        json={"model": "alibaba-media/qwen-image", "prompt": "A sunset over mountains", "size": "1024x1024"},
        timeout=180
    )
    print(f"Status: {r.status_code}")
    data = r.json()
    if r.status_code == 200:
        print("PASS - Image generation successful")
        if data.get("data"):
            print(f"  URL: {str(data['data'][0].get('url', 'N/A'))[:80]}...")
    else:
        print(f"FAIL - {json.dumps(data, indent=2)[:300]}")
except Exception as e:
    print(f"Error: {e}")

# Test 2: Image Edit with valid URL
print("\n2. IMAGE EDIT TEST: qwen-image-edit")
try:
    r = requests.post(
        f"{BASE_URL}/v1/images/edits",
        headers=headers,
        json={
            "model": "alibaba-media/qwen-image-edit",
            "prompt": "Add a rainbow",
            "image": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20240718/xfpbem/1.jpg"
        },
        timeout=180
    )
    print(f"Status: {r.status_code}")
    data = r.json()
    if r.status_code == 200:
        print("PASS - Image edit successful")
        if data.get("data"):
            print(f"  URL: {str(data['data'][0].get('url', 'N/A'))[:80]}...")
    else:
        print(f"FAIL - {json.dumps(data, indent=2)[:300]}")
except Exception as e:
    print(f"Error: {e}")

# Test 3: Video Generation
print("\n3. VIDEO TEST: wan2.6-t2v")
try:
    r = requests.post(
        f"{BASE_URL}/v1/video/generations",
        headers=headers,
        json={"model": "alibaba-media/wan2.6-t2v", "prompt": "A cat walking on grass"},
        timeout=300
    )
    print(f"Status: {r.status_code}")
    data = r.json()
    if r.status_code == 200:
        print("PASS - Video generation successful")
        if data.get("data"):
            print(f"  URL: {str(data['data'][0].get('url', 'N/A'))[:80]}...")
    else:
        print(f"FAIL - {json.dumps(data, indent=2)[:300]}")
except requests.exceptions.Timeout:
    print("TIMEOUT (300s) - video generation takes longer than expected")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 60)
print("Test Complete")
print("=" * 60)

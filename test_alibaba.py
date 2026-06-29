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
print("Testing Alibaba Media Provider")
print("=" * 60)

# Test 1: Video Generation
print("\n1. VIDEO TEST: wan2.1-t2v-plus")
try:
    r = requests.post(
        f"{BASE_URL}/v1/video/generations",
        headers=headers,
        json={"model": "alibaba-media/wan2.1-t2v-plus", "prompt": "A cat walking on grass"},
        timeout=120
    )
    print(f"Status: {r.status_code}")
    data = r.json()
    print(json.dumps(data, indent=2)[:300])
except Exception as e:
    print(f"Error: {e}")

# Test 2: Image Generation
print("\n2. IMAGE TEST: qwen-image")
try:
    r = requests.post(
        f"{BASE_URL}/v1/images/generations",
        headers=headers,
        json={"model": "alibaba-media/qwen-image", "prompt": "A sunset over mountains", "size": "1024x1024"},
        timeout=120
    )
    print(f"Status: {r.status_code}")
    data = r.json()
    print(json.dumps(data, indent=2)[:300])
except Exception as e:
    print(f"Error: {e}")

# Test 3: Image Edit
print("\n3. IMAGE EDIT TEST: qwen-image-edit")
try:
    r = requests.post(
        f"{BASE_URL}/v1/images/edits",
        headers=headers,
        json={
            "model": "alibaba-media/qwen-image-edit",
            "prompt": "Add a rainbow",
            "image": "https://dashscope.oss-cn-beijing.aliyuncs.com/images/qwen_edit_sample.png"
        },
        timeout=120
    )
    print(f"Status: {r.status_code}")
    data = r.json()
    print(json.dumps(data, indent=2)[:300])
except Exception as e:
    print(f"Error: {e}")

#!/bin/bash
cd /home/sirobo/toprouter

echo "=== Testing Video Generation ==="
curl -s -X POST http://localhost:20128/v1/video/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer *** \
  -d '{"model":"alibaba-media/wan2.1-t2v-plus","prompt":"A cat walking on grass"}'

echo ""
echo "=== Testing Image Generation ==="
curl -s -X POST http://localhost:20128/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer *** \
  -d '{"model":"alibaba-media/qwen-image","prompt":"A sunset over mountains","size":"1024x1024"}'

echo ""
echo "=== Testing Image Edit ==="
curl -s -X POST http://localhost:20128/v1/images/edits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer *** \
  -d '{"model":"alibaba-media/qwen-image-edit","prompt":"Add a rainbow","image":"https://example.com/image.jpg"}'

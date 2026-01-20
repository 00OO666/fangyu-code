#!/usr/bin/env python3
import time
import requests

API_KEY = "sk-vh7uTJC2bjZcg82woIlV12OWjLoNjSrCBIrrfG07Ew9W19rn"

endpoints = [
    "https://www.longwendie.cc/claude/messages",
    "https://www.longwendie.cc/claude/v1/messages",
    "https://www.longwendie.cc/claude//v1/messages",
]

for endpoint in endpoints:
    print(f"\n测试: {endpoint}")
    try:
        start = time.time()
        response = requests.post(
            endpoint,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {API_KEY}",
            },
            json={
                "model": "claude-opus-4-5-20251101",
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 10,
            },
            timeout=10
        )
        elapsed = time.time() - start
        print(f"  时间: {elapsed:.2f}s")
        print(f"  状态: {response.status_code}")
    except Exception as e:
        print(f"  错误: {e}")

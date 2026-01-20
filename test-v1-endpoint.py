#!/usr/bin/env python3
import time
import requests

API_KEY = "sk-vh7uTJC2bjZcg82woIlV12OWjLoNjSrCBIrrfG07Ew9W19rn"
ENDPOINT = "https://www.longwendie.cc/claude/v1/messages"

print("测试 /v1/messages 端点速度")
print("="*60)

results = []
for i in range(5):
    try:
        start = time.time()
        response = requests.post(
            ENDPOINT,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "claude-opus-4-5-20251101",
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 50,
            },
            timeout=30
        )
        elapsed = time.time() - start

        if response.status_code == 200:
            print(f"第 {i+1} 次: ✓ {elapsed:.2f}s")
            results.append(elapsed)
        else:
            print(f"第 {i+1} 次: ✗ HTTP {response.status_code}")
    except Exception as e:
        print(f"第 {i+1} 次: ✗ {e}")

    time.sleep(0.5)

if results:
    print("\n" + "="*60)
    print(f"平均时间: {sum(results)/len(results):.2f}s")
    print(f"最快: {min(results):.2f}s")
    print(f"最慢: {max(results):.2f}s")

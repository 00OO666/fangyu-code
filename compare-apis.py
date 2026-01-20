#!/usr/bin/env python3
import time
import requests

# 测试两个 API 的速度对比
APIs = [
    {
        "name": "hone.vvvv.ee",
        "base_url": "https://hone.vvvv.ee/v1",
        "token": "sk-BTyzU9GEEmn99dzGEGWhAM9GkFVHw4dgYYKFsVsn1KAXa3VW"
    },
    {
        "name": "longwendie.cc",
        "base_url": "https://www.longwendie.cc/claude",
        "token": "sk-vh7uTJC2bjZcg82woIlV12OWjLoNjSrCBIrrfG07Ew9W19rn"
    }
]

print("="*70)
print("API 速度对比测试")
print("="*70)

for api in APIs:
    print(f"\n测试 API: {api['name']}")
    print(f"Base URL: {api['base_url']}")
    print("-"*70)

    # 测试不同的端点路径
    endpoints = [
        f"{api['base_url']}/messages",
        f"{api['base_url']}/v1/messages",
    ]

    for endpoint in endpoints:
        print(f"\n端点: {endpoint}")
        results = []

        for i in range(3):
            try:
                start = time.time()
                response = requests.post(
                    endpoint,
                    headers={
                        "Authorization": f"Bearer {api['token']}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "claude-opus-4-5-20251101",
                        "messages": [{"role": "user", "content": "Hi"}],
                        "max_tokens": 50,
                    },
                    timeout=15
                )
                elapsed = time.time() - start

                if response.status_code == 200:
                    print(f"  第 {i+1} 次: ✓ {elapsed:.2f}s")
                    results.append(elapsed)
                else:
                    print(f"  第 {i+1} 次: ✗ HTTP {response.status_code}")
                    break
            except Exception as e:
                print(f"  第 {i+1} 次: ✗ {str(e)[:50]}")
                break

            time.sleep(0.3)

        if results:
            avg = sum(results) / len(results)
            print(f"  → 平均: {avg:.2f}s")

print("\n" + "="*70)

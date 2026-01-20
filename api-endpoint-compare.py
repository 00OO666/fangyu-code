#!/usr/bin/env python3
"""
对比不同 API 端点的速度
"""

import time
import requests

API_KEY = "sk-vh7uTJC2bjZcg82woIlV12OWjLoNjSrCBIrrfG07Ew9W19rn"
BASE_URL = "https://www.longwendie.cc/claude"

def test_endpoint(endpoint_path, name):
    """测试特定端点"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    payload = {
        "model": "claude-opus-4-5-20251101",
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 50,
        "stream": False
    }

    print(f"\n测试: {name}")
    print(f"端点: {endpoint_path}")
    print("-" * 60)

    results = []
    for i in range(3):
        try:
            start = time.time()
            response = requests.post(
                endpoint_path,
                headers=headers,
                json=payload,
                timeout=60
            )
            elapsed = time.time() - start

            if response.status_code == 200:
                print(f"  第 {i+1} 次: ✓ {elapsed:.2f}s")
                results.append(elapsed)
            else:
                print(f"  第 {i+1} 次: ✗ HTTP {response.status_code}")
                print(f"    {response.text[:100]}")
        except Exception as e:
            print(f"  第 {i+1} 次: ✗ {e}")

        time.sleep(0.5)

    if results:
        avg = sum(results) / len(results)
        print(f"\n平均时间: {avg:.2f}s")
        return avg
    return None

print("="*60)
print("API 端点对比测试")
print("="*60)

# 测试不同的端点
endpoints = [
    (f"{BASE_URL}/messages", "无 /v1 前缀"),
    (f"{BASE_URL}/v1/messages", "有 /v1 前缀"),
]

results = {}
for endpoint, name in endpoints:
    avg = test_endpoint(endpoint, name)
    if avg:
        results[name] = avg

print("\n" + "="*60)
print("结果汇总")
print("="*60)

for name, avg in results.items():
    print(f"{name}: {avg:.2f}s")

if len(results) == 2:
    ratio = max(results.values()) / min(results.values())
    print(f"\n速度差异: {ratio:.2f}x")

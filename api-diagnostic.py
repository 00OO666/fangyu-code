#!/usr/bin/env python3
"""
诊断工具：检查影响 API 速度的因素
"""

import time
import requests
import json
import subprocess

API_URL = "https://www.longwendie.cc/claude"
API_KEY = "sk-vh7uTJC2bjZcg82woIlV12OWjLoNjSrCBIrrfG07Ew9W19rn"

print("="*60)
print("API 速度诊断工具")
print("="*60)

# 1. 网络延迟测试
print("\n[1] 网络延迟测试")
print("-"*60)

try:
    # Ping 测试
    start = time.time()
    response = requests.get("https://www.longwendie.cc", timeout=10)
    latency = (time.time() - start) * 1000
    print(f"✓ 网站响应时间: {latency:.0f}ms")
    print(f"✓ HTTP 状态码: {response.status_code}")
except Exception as e:
    print(f"✗ 网络测试失败: {e}")

# 2. DNS 解析测试
print("\n[2] DNS 解析测试")
print("-"*60)

try:
    import socket
    start = time.time()
    ip = socket.gethostbyname("www.longwendie.cc")
    dns_time = (time.time() - start) * 1000
    print(f"✓ 域名: www.longwendie.cc")
    print(f"✓ IP 地址: {ip}")
    print(f"✓ DNS 解析时间: {dns_time:.0f}ms")
except Exception as e:
    print(f"✗ DNS 解析失败: {e}")

# 3. API 端点测试
print("\n[3] API 端点连接测试")
print("-"*60)

try:
    start = time.time()
    response = requests.get(f"{API_URL}/v1/models",
                          headers={"Authorization": f"Bearer {API_KEY}"},
                          timeout=10)
    api_latency = (time.time() - start) * 1000
    print(f"✓ API 端点响应时间: {api_latency:.0f}ms")
    print(f"✓ HTTP 状态码: {response.status_code}")
except Exception as e:
    print(f"✗ API 端点测试失败: {e}")

# 4. 最小请求测试（对比）
print("\n[4] 最小请求对比测试")
print("-"*60)

test_cases = [
    ("极简请求（10 tokens）", "Hi", 10),
    ("短请求（50 tokens）", "请用一句话介绍 AI", 50),
    ("中等请求（200 tokens）", "请详细介绍人工智能的发展历史", 200),
]

for name, prompt, max_tokens in test_cases:
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        }

        payload = {
            "model": "claude-opus-4-5-20251101",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "stream": False
        }

        start = time.time()
        response = requests.post(
            f"{API_URL}/v1/messages",
            headers=headers,
            json=payload,
            timeout=60
        )
        total_time = time.time() - start

        if response.status_code == 200:
            data = response.json()
            output_tokens = data.get("usage", {}).get("output_tokens", 0)
            print(f"\n{name}:")
            print(f"  总时间: {total_time:.2f}s")
            print(f"  输出 tokens: {output_tokens}")
            print(f"  速度: {output_tokens/total_time:.1f} tokens/s")
        else:
            print(f"\n{name}: ✗ HTTP {response.status_code}")

    except Exception as e:
        print(f"\n{name}: ✗ {e}")

# 5. 检查是否有代理
print("\n[5] 代理检查")
print("-"*60)

import os
http_proxy = os.environ.get('HTTP_PROXY') or os.environ.get('http_proxy')
https_proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')

if http_proxy or https_proxy:
    print(f"⚠️  检测到代理设置:")
    if http_proxy:
        print(f"  HTTP_PROXY: {http_proxy}")
    if https_proxy:
        print(f"  HTTPS_PROXY: {https_proxy}")
    print(f"  代理可能影响速度")
else:
    print(f"✓ 未检测到代理设置")

# 6. 对比其他 API（如果可用）
print("\n[6] 建议")
print("-"*60)
print("""
基于测试结果，可能的慢速原因：

1. API 服务器响应慢
   - 服务器负载高
   - 地理位置远（网络延迟）
   - 服务器性能限制

2. 模型处理慢
   - Opus 4.5 是最大的模型，处理时间长
   - 可以尝试切换到 Sonnet 或 Haiku

3. 上下文过大
   - Claude Code 会发送大量上下文（CLAUDE.md、文件内容等）
   - 可以精简 CLAUDE.md
   - 减少不必要的文件读取

4. Thinking Mode
   - 当前开启了 thinking mode，会增加输出 tokens
   - 可以关闭 thinking mode 提升速度

5. 网络问题
   - 检查是否有代理影响
   - 尝试更换网络环境

建议操作：
- 切换到更快的模型（Sonnet 或 Haiku）
- 关闭 thinking mode
- 精简 CLAUDE.md 内容
- 考虑更换 API 服务商
""")

print("\n" + "="*60)
print("诊断完成")
print("="*60)

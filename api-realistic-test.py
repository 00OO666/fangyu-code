#!/usr/bin/env python3
"""
真实场景 API 速度测试
对比不同场景下的响应时间
"""

import time
import requests
import json

API_URL = "https://www.longwendie.cc/claude"
API_KEY = "sk-vh7uTJC2bjZcg82woIlV12OWjLoNjSrCBIrrfG07Ew9W19rn"
MODEL = "claude-opus-4-5-20251101"

def test_scenario(name, messages, max_tokens, stream=False):
    """测试特定场景"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
        "anthropic-version": "2023-06-01"
    }

    payload = {
        "model": MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": stream
    }

    print(f"\n{'='*60}")
    print(f"场景: {name}")
    print(f"上下文大小: {len(json.dumps(messages))} 字符")
    print(f"最大 tokens: {max_tokens}")
    print(f"流式输出: {stream}")
    print(f"{'='*60}")

    try:
        start_time = time.time()

        if stream:
            # 流式请求
            response = requests.post(
                f"{API_URL}/v1/messages",
                headers=headers,
                json=payload,
                stream=True,
                timeout=120
            )

            first_chunk_time = None
            chunk_count = 0

            for line in response.iter_lines():
                if line:
                    chunk_count += 1
                    if first_chunk_time is None:
                        first_chunk_time = time.time()

            end_time = time.time()

            ttfb = first_chunk_time - start_time if first_chunk_time else None
            total_time = end_time - start_time

            print(f"✓ 首字节时间 (TTFB): {ttfb:.2f}s")
            print(f"✓ 总时间: {total_time:.2f}s")
            print(f"✓ 接收块数: {chunk_count}")

            return {
                "success": True,
                "ttfb": ttfb,
                "total_time": total_time,
                "chunks": chunk_count
            }
        else:
            # 非流式请求
            response = requests.post(
                f"{API_URL}/v1/messages",
                headers=headers,
                json=payload,
                timeout=120
            )
            end_time = time.time()

            total_time = end_time - start_time

            if response.status_code == 200:
                data = response.json()
                output_tokens = data.get("usage", {}).get("output_tokens", 0)

                print(f"✓ 总时间: {total_time:.2f}s")
                print(f"✓ 输出 tokens: {output_tokens}")
                print(f"✓ 速度: {output_tokens/total_time:.1f} tokens/s")

                return {
                    "success": True,
                    "total_time": total_time,
                    "output_tokens": output_tokens,
                    "tokens_per_sec": output_tokens/total_time
                }
            else:
                print(f"✗ 错误: HTTP {response.status_code}")
                print(f"  {response.text[:200]}")
                return {"success": False, "error": response.text[:200]}

    except Exception as e:
        print(f"✗ 异常: {str(e)}")
        return {"success": False, "error": str(e)}

# 场景 1: 简单提示（类似测试）
print("\n" + "="*60)
print("开始真实场景测试")
print("="*60)

scenario1 = test_scenario(
    "场景1: 简单提示（100 tokens）",
    [{"role": "user", "content": "请用一句话介绍人工智能。"}],
    100,
    stream=False
)

# 场景 2: 中等复杂度（500 tokens）
scenario2 = test_scenario(
    "场景2: 中等复杂度（500 tokens）",
    [{"role": "user", "content": "请详细解释什么是人工智能，包括其历史、应用和未来发展趋势。"}],
    500,
    stream=False
)

# 场景 3: 大量上下文（模拟真实对话）
long_context = """
你是 Claude Code，一个 AI 编程助手。

当前项目信息：
- 项目路径: F:\\Fangyu-Code-Dev
- 项目类型: Tauri + React 桌面应用
- 技术栈: TypeScript, React, Vite, Tauri

用户之前的对话历史：
1. 用户询问了如何测试 API 速度
2. 你创建了测试脚本
3. 测试结果显示响应很快

现在用户问：为什么测试时很快，但实际使用时感觉慢？

请分析可能的原因并给出建议。
"""

scenario3 = test_scenario(
    "场景3: 大量上下文（1000 tokens）",
    [{"role": "user", "content": long_context}],
    1000,
    stream=False
)

# 场景 4: 大量输出（模拟代码生成）
scenario4 = test_scenario(
    "场景4: 大量输出（4000 tokens）",
    [{"role": "user", "content": "请写一个完整的 Python 类，实现一个简单的任务队列系统，包括添加任务、执行任务、错误处理等功能。"}],
    4000,
    stream=False
)

# 场景 5: 流式输出（模拟实际使用）
scenario5 = test_scenario(
    "场景5: 流式输出（1000 tokens）",
    [{"role": "user", "content": "请详细解释为什么 API 测试时很快，但实际使用时感觉慢。"}],
    1000,
    stream=True
)

# 汇总结果
print("\n" + "="*60)
print("测试结果汇总")
print("="*60)

results = [
    ("场景1: 简单提示（100 tokens）", scenario1),
    ("场景2: 中等复杂度（500 tokens）", scenario2),
    ("场景3: 大量上下文（1000 tokens）", scenario3),
    ("场景4: 大量输出（4000 tokens）", scenario4),
    ("场景5: 流式输出（1000 tokens）", scenario5),
]

for name, result in results:
    if result.get("success"):
        print(f"\n{name}")
        print(f"  总时间: {result.get('total_time', 'N/A'):.2f}s")
        if "tokens_per_sec" in result:
            print(f"  速度: {result['tokens_per_sec']:.1f} tokens/s")
        if "ttfb" in result:
            print(f"  首字节时间: {result['ttfb']:.2f}s")

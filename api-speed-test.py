#!/usr/bin/env python3
"""
API 模型速度测试工具
测试不同模型的响应速度（TTFB 和总响应时间）
"""

import time
import requests
import json
from typing import Dict, List
from statistics import mean, median

# ==================== 配置区 ====================

# API 配置
API_BASE_URL = "https://your-api-endpoint.com/v1"  # 修改为你的 API 端点
API_KEY = "your-api-key-here"  # 修改为你的 API Key

# 要测试的模型列表
MODELS = [
    "claude-opus-4-5-20251101",
    "claude-sonnet-4-20250514",
    "claude-3-5-haiku-20241022",
    # 添加更多模型...
]

# 测试配置
TEST_PROMPT = "请用一句话介绍人工智能。"  # 测试用的提示词
NUM_TESTS = 3  # 每个模型测试次数
TIMEOUT = 30  # 请求超时时间（秒）

# ==================== 测试逻辑 ====================

def test_model_speed(model: str, prompt: str) -> Dict:
    """测试单个模型的响应速度"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
        "anthropic-version": "2023-06-01"  # 根据实际 API 调整
    }

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 100,
        "stream": False
    }

    try:
        start_time = time.time()
        response = requests.post(
            f"{API_BASE_URL}/messages",
            headers=headers,
            json=payload,
            timeout=TIMEOUT
        )
        end_time = time.time()

        total_time = end_time - start_time

        if response.status_code == 200:
            return {
                "success": True,
                "total_time": total_time,
                "status_code": response.status_code,
                "response_length": len(response.text)
            }
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}: {response.text[:200]}",
                "total_time": total_time
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "total_time": None
        }

def run_tests():
    """运行所有测试"""
    print("=" * 60)
    print("API 模型速度测试")
    print("=" * 60)
    print(f"API 端点: {API_BASE_URL}")
    print(f"测试提示词: {TEST_PROMPT}")
    print(f"每个模型测试次数: {NUM_TESTS}")
    print("=" * 60)
    print()

    results = {}

    for model in MODELS:
        print(f"测试模型: {model}")
        model_results = []

        for i in range(NUM_TESTS):
            print(f"  第 {i+1}/{NUM_TESTS} 次测试...", end=" ")
            result = test_model_speed(model, TEST_PROMPT)

            if result["success"]:
                print(f"✓ {result['total_time']:.2f}s")
                model_results.append(result["total_time"])
            else:
                print(f"✗ {result['error']}")

            time.sleep(0.5)  # 避免请求过快

        if model_results:
            results[model] = {
                "times": model_results,
                "avg": mean(model_results),
                "median": median(model_results),
                "min": min(model_results),
                "max": max(model_results)
            }
        else:
            results[model] = None

        print()

    # 输出汇总结果
    print("=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    print()

    # 按平均速度排序
    sorted_results = sorted(
        [(model, data) for model, data in results.items() if data],
        key=lambda x: x[1]["avg"]
    )

    print(f"{'模型':<40} {'平均':<10} {'中位数':<10} {'最快':<10} {'最慢':<10}")
    print("-" * 80)

    for model, data in sorted_results:
        print(f"{model:<40} {data['avg']:.2f}s    {data['median']:.2f}s    {data['min']:.2f}s    {data['max']:.2f}s")

    # 输出失败的模型
    failed_models = [model for model, data in results.items() if not data]
    if failed_models:
        print()
        print("失败的模型:")
        for model in failed_models:
            print(f"  - {model}")

if __name__ == "__main__":
    run_tests()

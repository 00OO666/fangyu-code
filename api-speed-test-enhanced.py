#!/usr/bin/env python3
"""
API 模型速度测试工具（支持配置文件）
测试不同模型的响应速度（TTFB 和总响应时间）

使用方法:
  python api-speed-test-enhanced.py                    # 使用默认配置文件
  python api-speed-test-enhanced.py config.json        # 使用指定配置文件
"""

import time
import requests
import json
import sys
from typing import Dict, List
from statistics import mean, median
from pathlib import Path

def load_config(config_path: str = "api-speed-test-config.json") -> Dict:
    """加载配置文件"""
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"错误: 配置文件 {config_path} 不存在")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"错误: 配置文件格式错误 - {e}")
        sys.exit(1)

def test_model_speed(api_url: str, api_key: str, model: str, prompt: str,
                     max_tokens: int, timeout: int) -> Dict:
    """测试单个模型的响应速度"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    # 根据 API 类型调整请求格式
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "stream": False
    }

    try:
        start_time = time.time()
        response = requests.post(
            f"{api_url}/messages",
            headers=headers,
            json=payload,
            timeout=timeout
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
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "error": f"请求超时 (>{timeout}s)",
            "total_time": None
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "total_time": None
        }

def run_tests(config: Dict):
    """运行所有测试"""
    api_url = config["api_base_url"]
    api_key = config["api_key"]
    models = config["models"]
    test_config = config["test_config"]

    print("=" * 80)
    print("API 模型速度测试")
    print("=" * 80)
    print(f"API 端点: {api_url}")
    print(f"测试提示词: {test_config['prompt']}")
    print(f"每个模型测试次数: {test_config['num_tests']}")
    print(f"最大 tokens: {test_config['max_tokens']}")
    print("=" * 80)
    print()

    results = {}

    for model in models:
        print(f"测试模型: {model}")
        model_results = []

        for i in range(test_config['num_tests']):
            print(f"  第 {i+1}/{test_config['num_tests']} 次测试...", end=" ", flush=True)
            result = test_model_speed(
                api_url, api_key, model,
                test_config['prompt'],
                test_config['max_tokens'],
                test_config['timeout']
            )

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
    print("=" * 80)
    print("测试结果汇总")
    print("=" * 80)
    print()

    # 按平均速度排序
    sorted_results = sorted(
        [(model, data) for model, data in results.items() if data],
        key=lambda x: x[1]["avg"]
    )

    if sorted_results:
        print(f"{'模型':<45} {'平均':<10} {'中位数':<10} {'最快':<10} {'最慢':<10}")
        print("-" * 85)

        for model, data in sorted_results:
            print(f"{model:<45} {data['avg']:.2f}s    {data['median']:.2f}s    "
                  f"{data['min']:.2f}s    {data['max']:.2f}s")

        # 显示速度对比
        print()
        print("速度对比（相对于最快的模型）:")
        fastest_time = sorted_results[0][1]["avg"]
        for model, data in sorted_results:
            ratio = data["avg"] / fastest_time
            print(f"  {model}: {ratio:.2f}x")

    # 输出失败的模型
    failed_models = [model for model, data in results.items() if not data]
    if failed_models:
        print()
        print("失败的模型:")
        for model in failed_models:
            print(f"  - {model}")

    # 保存结果到文件
    output_file = "api-speed-test-results.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "config": config,
            "results": results
        }, f, indent=2, ensure_ascii=False)
    print()
    print(f"详细结果已保存到: {output_file}")

if __name__ == "__main__":
    config_file = sys.argv[1] if len(sys.argv) > 1 else "api-speed-test-config.json"
    config = load_config(config_file)
    run_tests(config)

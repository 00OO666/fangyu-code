#!/usr/bin/env python3
"""
Fangyu Code 版本号自动更新脚本

用法：python scripts/bump-version.py <新版本号>
示例：python scripts/bump-version.py 2.3.0

功能：
- 自动更新 package.json 中的 version
- 自动更新 src-tauri/tauri.conf.json 中的 version
- 自动更新 src-tauri/Cargo.toml 中的 version
"""

import sys
import json
import re
from pathlib import Path


def bump_version(new_version):
    """更新三处版本号"""

    # 验证版本号格式
    if not re.match(r'^\d+\.\d+\.\d+$', new_version):
        print(f"❌ 错误：版本号格式不正确：{new_version}")
        print("   正确格式：x.y.z（例如：2.3.0）")
        sys.exit(1)

    project_root = Path(__file__).parent.parent

    # 1. 更新 package.json
    package_json_path = project_root / 'package.json'
    try:
        with open(package_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        old_version = data.get('version', 'unknown')
        data['version'] = new_version

        with open(package_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write('\n')  # 添加末尾换行符

        print(f"✅ package.json: {old_version} → {new_version}")
    except Exception as e:
        print(f"❌ 更新 package.json 失败：{e}")
        sys.exit(1)

    # 2. 更新 src-tauri/tauri.conf.json
    tauri_conf_path = project_root / 'src-tauri' / 'tauri.conf.json'
    try:
        with open(tauri_conf_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        old_version = data.get('version', 'unknown')
        data['version'] = new_version

        with open(tauri_conf_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write('\n')

        print(f"✅ src-tauri/tauri.conf.json: {old_version} → {new_version}")
    except Exception as e:
        print(f"❌ 更新 src-tauri/tauri.conf.json 失败：{e}")
        sys.exit(1)

    # 3. 更新 src-tauri/Cargo.toml
    cargo_toml_path = project_root / 'src-tauri' / 'Cargo.toml'
    try:
        with open(cargo_toml_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 提取旧版本号
        old_version_match = re.search(r'^version\s*=\s*"([^"]+)"', content, re.MULTILINE)
        old_version = old_version_match.group(1) if old_version_match else 'unknown'

        # 替换版本号（只替换第一个出现的 version = "..."）
        new_content = re.sub(
            r'^version\s*=\s*"[^"]+"',
            f'version = "{new_version}"',
            content,
            count=1,
            flags=re.MULTILINE
        )

        with open(cargo_toml_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"✅ src-tauri/Cargo.toml: {old_version} → {new_version}")
    except Exception as e:
        print(f"❌ 更新 src-tauri/Cargo.toml 失败：{e}")
        sys.exit(1)

    print(f"\n🎉 版本号已成功更新到 {new_version}")
    print("\n下一步：")
    print(f"1. 更新 CHANGELOGS：src/hooks/useFirstLaunchChangelog.ts")
    print(f"2. 提交代码：git add . && git commit -m \"v{new_version}: 更新说明\"")
    print(f"3. 打标签：git tag -a v{new_version} -m \"Release v{new_version}\"")
    print(f"4. 推送：git push origin main && git push origin v{new_version}")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("用法：python scripts/bump-version.py <新版本号>")
        print("示例：python scripts/bump-version.py 2.3.0")
        sys.exit(1)

    new_version = sys.argv[1]
    bump_version(new_version)

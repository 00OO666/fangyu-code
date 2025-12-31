// 为 Windows 生成 ICO 文件
// 使用多个 PNG 尺寸合并成一个 ICO
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ICONS_DIR = './src-tauri/icons';

async function generateICO() {
  console.log('🔧 生成 Windows ICO 文件...\n');

  // 检查是否有 ImageMagick
  try {
    // 尝试使用 PowerShell 脚本生成 ICO
    const sizes = [16, 20, 24, 32, 40, 48, 64, 256];
    const pngFiles = [];

    // 生成所有需要的尺寸
    for (const size of sizes) {
      const filename = `icon-${size}.png`;
      const filepath = path.join(ICONS_DIR, filename);

      await sharp('E:/Desktop/1Going Global/LOGO矢量图.png')
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(filepath);

      pngFiles.push(filename);
      console.log(`✅ 生成 ${size}x${size} PNG`);
    }

    console.log('\n⚠️ ICO 文件转换需要额外工具');
    console.log('   推荐方案：');
    console.log('   1. 使用在线工具: https://icoconvert.com');
    console.log('   2. 或安装 ImageMagick: https://imagemagick.org/');
    console.log(`   3. 或使用 npm 包: npm install -g to-ico`);
    console.log(`\n   生成的 PNG 文件位于: ${ICONS_DIR}/icon-*.png`);

  } catch (err) {
    console.error('❌ 错误:', err.message);
  }
}

generateICO();

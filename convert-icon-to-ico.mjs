// 将 Fangyu LOGO PNG 转换为 ICO 格式
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function convertToICO() {
  console.log('🎨 正在将 Fangyu LOGO 转换为 ICO 格式...\n');

  const sourceLogo = 'E:/Desktop/1Going Global/LOGO矢量图.png';
  const iconsDir = './src-tauri/icons';
  const outputIco = path.join(iconsDir, 'icon.ico');

  // 生成多个尺寸的 PNG 用于 ICO
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngFiles = [];

  console.log('📐 生成多尺寸 PNG...');
  for (const size of sizes) {
    const tempFile = path.join(iconsDir, `temp-${size}.png`);
    await sharp(sourceLogo)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(tempFile);
    pngFiles.push(tempFile);
    console.log(`  ✅ ${size}x${size}`);
  }

  console.log('\n🔧 合并为 ICO 文件...');
  const icoBuffer = await pngToIco(pngFiles);
  fs.writeFileSync(outputIco, icoBuffer);

  // 清理临时文件
  console.log('\n🧹 清理临时文件...');
  pngFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });

  console.log('\n✅ ICO 图标生成成功!');
  console.log(`   位置: ${outputIco}`);
  console.log(`   大小: ${(fs.statSync(outputIco).size / 1024).toFixed(2)} KB`);
}

convertToICO().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});

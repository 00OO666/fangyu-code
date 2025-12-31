// 使用用户的 LOGO 生成各种尺寸的应用图标
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SOURCE_LOGO = 'E:/Desktop/1Going Global/LOGO矢量图.png';
const ICONS_DIR = './src-tauri/icons';

// Tauri 需要的图标尺寸
const ICON_SIZES = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  // Windows Store 图标
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

async function generateIcons() {
  console.log('🎨 开始生成 Fangyu Code 图标...\n');
  console.log(`源文件: ${SOURCE_LOGO}`);
  console.log(`输出目录: ${ICONS_DIR}\n`);

  // 确保源文件存在
  if (!fs.existsSync(SOURCE_LOGO)) {
    console.error('❌ 源 LOGO 文件不存在！');
    process.exit(1);
  }

  // 读取源图片
  const sourceImage = sharp(SOURCE_LOGO);
  const metadata = await sourceImage.metadata();
  console.log(`源图片尺寸: ${metadata.width}x${metadata.height}\n`);

  // 生成各种尺寸的 PNG
  for (const icon of ICON_SIZES) {
    const outputPath = path.join(ICONS_DIR, icon.name);
    await sharp(SOURCE_LOGO)
      .resize(icon.size, icon.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }  // 透明背景
      })
      .png()
      .toFile(outputPath);
    console.log(`✅ ${icon.name} (${icon.size}x${icon.size})`);
  }

  // 生成 ICO 文件 (Windows)
  console.log('\n🔧 生成 Windows ICO 文件...');
  // ICO 需要多个尺寸，我们用最大的 256x256
  const icoPath = path.join(ICONS_DIR, 'icon.ico');
  // sharp 不直接支持 ICO，我们生成一个 256x256 的 PNG 作为替代
  // 用户可以后续用在线工具转换，或者我们保留原有的 ico
  await sharp(SOURCE_LOGO)
    .resize(256, 256, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-256.png'));
  console.log('✅ icon-256.png (用于生成 ICO)');

  // 生成 ICNS 文件 (macOS) - sharp 不支持，保留原文件或跳过
  console.log('\n⚠️ macOS ICNS 文件需要在 macOS 上生成，已跳过');

  console.log('\n🎉 图标生成完成！');
  console.log('\n📝 注意事项：');
  console.log('   - Windows ICO: 可使用 https://icoconvert.com 将 icon-256.png 转换');
  console.log('   - macOS ICNS: 需要在 macOS 上使用 iconutil 生成');
}

generateIcons().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});

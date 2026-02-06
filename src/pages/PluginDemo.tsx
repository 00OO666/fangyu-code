/**
 * 插件系统演示页面
 */

import { logger } from '@/lib/logger';
import { PluginManager } from "@/plugins";

export function PluginDemo() {
  return (
    <div className="h-screen w-full p-6 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">插件系统演示</h1>
          <p className="text-muted-foreground mt-2">
            Fangyu Code 插件扩展系统 - 完整的插件管理、市场和开发平台
          </p>
        </div>

        <PluginManager
          workspacePath={undefined}
          onInstall={(id) => {
            logger.debug('PluginDemo', "安装插件:", id);
          }}
          onUninstall={(id) => {
            logger.debug('PluginDemo', "卸载插件:", id);
          }}
        />
      </div>
    </div>
  );
}

export default PluginDemo;

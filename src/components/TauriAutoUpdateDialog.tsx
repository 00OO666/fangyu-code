/**
 * Tauri 自动更新对话框 - v2.0 增强版
 *
 * 功能：
 * - 显示更新提示、下载进度、安装进度
 * - 支持跳过特定版本
 * - 支持暂时关闭更新提示
 * - 支持重试失败的检查
 * - 更好的用户体验
 */

import React from 'react';
import { useTauriAutoUpdate } from '@/hooks/useTauriAutoUpdate';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, RefreshCw, AlertCircle, X, SkipForward } from 'lucide-react';

export const TauriAutoUpdateDialog: React.FC = () => {
  const {
    updateInfo,
    checking,
    downloading,
    installing,
    error,
    downloadProgress,
    isDismissed,
    installUpdate,
    skipVersion,
    dismissUpdate,
    retryCheck,
  } = useTauriAutoUpdate({
    checkForUpdates,
    checkOnMount: true,
    autoCheckInterval: 0, // 关闭自动检查，改为手动触发
  });

  // 是否显示对话框（有更新且未被暂时关闭）
  const showDialog = updateInfo?.available && !isDismissed && !downloading && !installing;
  // 暴露更新检查函数到 window 对象，供设置页面调用
  React.useEffect(() => {
    (window as any).__updateHook = {
      checkForUpdates,
      updateInfo,
      checking,
    };

    return () => {
      delete (window as any).__updateHook;
    };
  }, [checkForUpdates, updateInfo, checking]);

  return (
    <>
      {/* 更新提示对话框 */}
      <AlertDialog open={showDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-green-500" />
              发现新版本
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">当前版本:</span>
                <span className="font-medium">{updateInfo?.currentVersion}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">最新版本:</span>
                <span className="font-medium text-green-600">{updateInfo?.latestVersion}</span>
              </div>

              {updateInfo?.date && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">发布日期:</span>
                  <span className="font-medium">{new Date(updateInfo.date).toLocaleDateString('zh-CN')}</span>
                </div>
              )}

              {updateInfo?.body && (
                <div className="mt-4 p-3 bg-muted rounded-md text-sm">
                  <div className="font-medium mb-2">更新内容:</div>
                  <div className="whitespace-pre-wrap text-muted-foreground max-h-40 overflow-y-auto">
                    {updateInfo.body}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div>{error}</div>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-destructive underline mt-1"
                      onClick={retryCheck}
                    >
                      重试
                    </Button>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipVersion}
                className="flex-1"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                跳过此版本
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissUpdate}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                稍后提醒
              </Button>
            </div>
            <AlertDialogAction onClick={installUpdate} className="bg-green-600 hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" />
              立即更新
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 下载进度对话框 */}
      <AlertDialog open={downloading || installing}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {downloading && (
                <>
                  <Download className="h-5 w-5 animate-pulse text-blue-500" />
                  正在下载更新...
                </>
              )}
              {installing && (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin text-green-500" />
                  正在安装更新...
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              {downloading && (
                <>
                  <Progress value={downloadProgress} className="h-3" />
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>下载进度</span>
                    <span className="font-mono font-medium text-blue-600">{downloadProgress || 0}%</span>
                  </div>
                </>
              )}

              {installing && (
                <div className="text-center text-sm text-muted-foreground space-y-2">
                  <p>更新即将完成，应用将自动重启...</p>
                  <p className="text-xs">重启后将显示更新公告</p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div>{error}</div>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-destructive underline mt-1"
                      onClick={retryCheck}
                    >
                      重试
                    </Button>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TauriAutoUpdateDialog;

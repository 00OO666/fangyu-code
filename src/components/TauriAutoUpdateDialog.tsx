/**
 * Tauri 自动更新对话框
 *
 * 显示更新提示、下载进度、安装进度
 */

import React, { useEffect } from 'react';
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
import { Progress } from '@/components/ui/progress';
import { Download, RefreshCw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export const TauriAutoUpdateDialog: React.FC = () => {
  const {
    updateInfo,
    checking,
    downloading,
    installing,
    error,
    downloadProgress,
    installUpdate,
  } = useTauriAutoUpdate({
    checkOnMount: true,
    autoCheckInterval: 60, // 每小时检查一次
  });

  // 是否显示对话框
  const showDialog = updateInfo?.available && !downloading && !installing;

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
                  <span>{error}</span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>稍后更新</AlertDialogCancel>
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
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
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
                <div className="text-center text-sm text-muted-foreground">
                  更新即将完成，应用将自动重启...
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

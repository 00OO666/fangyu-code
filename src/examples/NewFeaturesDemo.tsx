/**
 * 新功能演示页面
 *
 * 自动从 CHANGELOGS 读取最新版本更新内容
 * 与首次启动弹窗保持同步
 */

import { motion } from "framer-motion";
import {
  Bug,
  Calendar,
  CheckCircle,
  ChevronRight,
  History,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHANGELOGS } from "@/hooks/useFirstLaunchChangelog";

// 获取所有版本号（从新到旧）
const versions = Object.keys(CHANGELOGS);
const latestVersion = versions[0];

/**
 * 单个版本的更新内容卡片
 */
function VersionCard({ version, isLatest }: { version: string; isLatest: boolean }) {
  const changelog = CHANGELOGS[version as keyof typeof CHANGELOGS];
  if (!changelog) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={isLatest ? "border-primary/50 shadow-lg shadow-primary/10" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${isLatest ? "bg-gradient-to-br from-purple-500 to-pink-500" : "bg-primary/10"}`}
              >
                {isLatest ? (
                  <Star className="h-5 w-5 text-white" />
                ) : (
                  <History className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {changelog.title}
                  {isLatest && (
                    <Badge
                      variant="default"
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0"
                    >
                      最新版本
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <Calendar className="h-3 w-3" />
                  {changelog.date}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 新功能 */}
          {changelog.features && changelog.features.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold text-sm">新功能</h3>
                <Badge variant="secondary" className="text-xs">
                  {changelog.features.length} 项
                </Badge>
              </div>
              <ul className="space-y-1.5 ml-6">
                {changelog.features.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}

          {/* 改进优化 */}
          {changelog.improvements && changelog.improvements.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <h3 className="font-semibold text-sm">改进优化</h3>
                <Badge variant="secondary" className="text-xs">
                  {changelog.improvements.length} 项
                </Badge>
              </div>
              <ul className="space-y-1.5 ml-6">
                {changelog.improvements.map((improvement, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <span>{improvement}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}

          {/* Bug 修复 */}
          {changelog.bugfixes && changelog.bugfixes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Bug className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold text-sm">Bug 修复</h3>
                <Badge variant="secondary" className="text-xs">
                  {changelog.bugfixes.length} 项
                </Badge>
              </div>
              <ul className="space-y-1.5 ml-6">
                {changelog.bugfixes.map((fix, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <span>{fix}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * 主演示组件
 */
export function NewFeaturesDemo() {
  const [activeTab, setActiveTab] = useState<"latest" | "history">("latest");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* 标题区域 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <Sparkles className="text-white h-6 w-6" />
          </div>
          <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Fangyu Code v{latestVersion}
          </span>
        </h1>
        <p className="text-muted-foreground">探索新版本的全新功能与改进</p>
      </motion.div>

      {/* 标签切换 */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "latest" | "history")}
        className="mb-6"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="latest" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            最新版本
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            历史版本
          </TabsTrigger>
        </TabsList>

        <TabsContent value="latest" className="mt-6">
          <VersionCard version={latestVersion} isLatest={true} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {versions.map((version, index) => (
                <VersionCard key={version} version={version} isLatest={index === 0} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* 底部信息 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-center text-sm text-muted-foreground"
      >
        <p className="flex items-center justify-center gap-1">
          <Sparkles className="h-3 w-3" />
          更多功能持续开发中...
        </p>
        <p className="mt-2">
          提交反馈:{" "}
          <a
            href="https://github.com/anthropics/claude-code/issues"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            GitHub Issues
            <ChevronRight className="h-3 w-3" />
          </a>
        </p>
      </motion.div>
    </div>
  );
}

export default NewFeaturesDemo;

/**
 * AppProviders - 统一的 Provider 组合组件
 *
 * 🏗️ 架构优化 (v2.7.6):
 * - 将 7 层 Context 嵌套合并为单一组件
 * - 提高代码可读性和维护性
 * - 减少不必要的重渲染
 *
 * Provider 层级说明:
 * 1. UpdateProvider - 应用更新状态
 * 2. GlobalTaskStateProvider - 全局任务状态
 * 3. OutputCacheProvider - 输出缓存
 * 4. NavigationProvider - 导航状态
 * 5. ProjectProvider - 项目状态
 * 6. TabProvider - 标签页状态
 * 7. PromptQueueProvider - 提示词队列
 *
 * _Requirements: 1.5_
 * **Validates: Requirements 1.5 - Context 嵌套优化**
 */

import { ReactNode } from 'react';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { TabProvider } from '@/hooks/useTabs';
import { UpdateProvider } from '@/contexts/UpdateContext';
import { OutputCacheProvider } from '@/lib/outputCache';
import { GlobalTaskStateProvider } from '@/hooks/useGlobalTaskState';
import { PromptQueueProvider } from '@/hooks/usePromptQueue';

interface AppProvidersProps {
    children: ReactNode;
}

/**
 * 组合所有应用级 Provider
 *
 * 使用函数组合模式，将多层嵌套转换为线性结构
 * 这样更容易理解和维护
 */
export function AppProviders({ children }: AppProvidersProps) {
    return (
        <UpdateProvider>
            <GlobalTaskStateProvider>
                <OutputCacheProvider>
                    <NavigationProvider>
                        <ProjectProvider>
                            <TabProvider>
                                <PromptQueueProvider>{children}</PromptQueueProvider>
                            </TabProvider>
                        </ProjectProvider>
                    </NavigationProvider>
                </OutputCacheProvider>
            </GlobalTaskStateProvider>
        </UpdateProvider>
    );
}

/**
 * Provider 组合工具函数
 *
 * 用于将多个 Provider 组合成单一组件
 * 避免深层嵌套，提高可读性
 *
 * @example
 * const CombinedProviders = composeProviders([
 *   [ThemeProvider, { theme: 'dark' }],
 *   [AuthProvider],
 *   [DataProvider, { cache: true }],
 * ]);
 */
type ProviderConfig<P = unknown> = [React.ComponentType<P & { children: ReactNode }>, P?];

export function composeProviders(providers: ProviderConfig[]): React.FC<{ children: ReactNode }> {
    return function ComposedProviders({ children }: { children: ReactNode }) {
        return providers.reduceRight((acc, [Provider, props]) => {
            return <Provider {...(props || {})}>{acc}</Provider>;
        }, children);
    };
}

export default AppProviders;

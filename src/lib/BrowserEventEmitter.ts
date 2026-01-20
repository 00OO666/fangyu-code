import { logger } from '@/lib/logger';

/**
 * BrowserEventEmitter - 浏览器兼容的事件发射器
 *
 * 替代 Node.js 的 EventEmitter，用于浏览器环境
 */

export type EventListener = (...args: unknown[]) => void;

export class BrowserEventEmitter {
    private listeners: Map<string, Set<EventListener>> = new Map();

    /**
     * 添加事件监听器
     */
    on(event: string, listener: EventListener): this {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
        return this;
    }

    /**
     * 添加一次性事件监听器
     */
    once(event: string, listener: EventListener): this {
        const onceWrapper = (...args: unknown[]) => {
            this.off(event, onceWrapper);
            listener(...args);
        };
        return this.on(event, onceWrapper);
    }

    /**
     * 移除事件监听器
     */
    off(event: string, listener: EventListener): this {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.delete(listener);
            if (eventListeners.size === 0) {
                this.listeners.delete(event);
            }
        }
        return this;
    }

    /**
     * 移除指定事件的所有监听器，或移除所有监听器
     */
    removeAllListeners(event?: string): this {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
        return this;
    }

    /**
     * 触发事件
     */
    emit(event: string, ...args: unknown[]): boolean {
        const eventListeners = this.listeners.get(event);
        if (!eventListeners || eventListeners.size === 0) {
            return false;
        }
        eventListeners.forEach((listener) => {
            try {
                listener(...args);
            } catch (error) {
                logger.error('BrowserEventEmitter', `Error in event listener for "${event}":`, error);
            }
        });
        return true;
    }

    /**
     * 获取指定事件的监听器数量
     */
    listenerCount(event: string): number {
        return this.listeners.get(event)?.size ?? 0;
    }

    /**
     * 获取所有事件名称
     */
    eventNames(): string[] {
        return Array.from(this.listeners.keys());
    }

    /**
     * 获取指定事件的所有监听器
     */
    getListeners(event: string): EventListener[] {
        return Array.from(this.listeners.get(event) ?? []);
    }
}

/**
 * AsyncQueue - 异步消息队列
 *
 * 实现生产者-消费者模式，用于：
 * 1. 接收来自 Tauri 事件的消息
 * 2. 支持 for await...of 语法消费
 * 3. 背压控制（队列缓冲）
 *
 * 借鉴自 Claudix 项目的 AsyncStream 设计
 */

export class AsyncQueue<T> implements AsyncIterable<T>, AsyncIterator<T> {
  private queue: T[] = [];
  private readResolve?: (value: IteratorResult<T>) => void;
  private readReject?: (error: unknown) => void;
  private isDone = false;
  private hasError?: unknown;
  private started = false;
  private onReturn?: () => void;

  constructor(onReturn?: () => void) {
    this.onReturn = onReturn;
  }

  /**
   * 实现异步迭代器协议
   */
  [Symbol.asyncIterator](): AsyncIterator<T> {
    if (this.started) {
      throw new Error('AsyncQueue can only be iterated once');
    }
    this.started = true;
    return this;
  }

  /**
   * 获取下一个值（消费者 API）
   */
  async next(): Promise<IteratorResult<T>> {
    // 1. 如果队列有数据，立即返回
    if (this.queue.length > 0) {
      return { done: false, value: this.queue.shift()! };
    }

    // 2. 如果流已结束，返回完成标志
    if (this.isDone) {
      return { done: true, value: undefined as unknown as T };
    }

    // 3. 如果有错误，拒绝 Promise
    if (this.hasError) {
      throw this.hasError;
    }

    // 4. 等待新数据到来
    return new Promise<IteratorResult<T>>((resolve, reject) => {
      this.readResolve = resolve;
      this.readReject = reject;
    });
  }

  /**
   * 生产数据（生产者 API）
   */
  enqueue(value: T): void {
    if (this.isDone) {
      console.warn('[AsyncQueue] Attempting to enqueue after done');
      return;
    }

    // 如果有消费者在等待，直接满足
    if (this.readResolve) {
      const resolve = this.readResolve;
      this.readResolve = undefined;
      this.readReject = undefined;
      resolve({ done: false, value });
    } else {
      // 否则加入队列
      this.queue.push(value);
    }
  }

  /**
   * 批量生产数据
   */
  enqueueAll(values: T[]): void {
    for (const value of values) {
      this.enqueue(value);
    }
  }

  /**
   * 标记流为完成状态
   */
  done(): void {
    if (this.isDone) return;

    this.isDone = true;

    // 如果有消费者在等待，通知完成
    if (this.readResolve) {
      const resolve = this.readResolve;
      this.readResolve = undefined;
      this.readReject = undefined;
      resolve({ done: true, value: undefined as unknown as T });
    }
  }

  /**
   * 设置错误状态
   */
  error(err: unknown): void {
    this.hasError = err;
    this.isDone = true;

    // 如果有消费者在等待，拒绝 Promise
    if (this.readReject) {
      const reject = this.readReject;
      this.readResolve = undefined;
      this.readReject = undefined;
      reject(err);
    }
  }

  /**
   * 清理资源
   */
  async return(): Promise<IteratorResult<T>> {
    this.isDone = true;
    this.onReturn?.();
    return { done: true, value: undefined as unknown as T };
  }

  /**
   * 获取当前队列长度
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * 检查队列是否已完成
   */
  get isComplete(): boolean {
    return this.isDone;
  }

  /**
   * 检查队列是否有错误
   */
  get hasErrorState(): boolean {
    return this.hasError !== undefined;
  }

  /**
   * 静态工厂方法：从数组创建队列
   */
  static from<T>(items: T[]): AsyncQueue<T> {
    const queue = new AsyncQueue<T>();
    for (const item of items) {
      queue.enqueue(item);
    }
    queue.done();
    return queue;
  }

  /**
   * 静态工厂方法：创建空的已完成队列
   */
  static empty<T>(): AsyncQueue<T> {
    const queue = new AsyncQueue<T>();
    queue.done();
    return queue;
  }
}

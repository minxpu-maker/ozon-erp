/**
 * Content Script 消息总线
 * 用于组件间通信
 */

type MessageHandler = (payload?: unknown) => void;

export class MessageBus {
  private handlers: Map<string, Set<MessageHandler>> = new Map();

  /**
   * 发送消息
   */
  send(type: string, payload?: unknown): void {
    // 触发本地处理器
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[MessageBus] Error in handler for ${type}:`, error);
        }
      });
    }
  }

  /**
   * 订阅消息
   */
  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  /**
   * 取消订阅
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * 清空所有订阅
   */
  clear(): void {
    this.handlers.clear();
  }
}

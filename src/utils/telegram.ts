import { Context, Telegraf } from 'telegraf';

/**
 * 安全发送消息，处理错误
 * @param ctx 聊天上下文或ID
 * @param message 消息内容
 * @param options 发送选项
 */
export async function safeSendMessage(ctx: Context | string, message: string, options?: any): Promise<void> {
  try {
    if (typeof ctx === 'string') {
      // 如果是字符串ID，获取bot实例
      const bot = (global as any).bot as Telegraf;
      if (!bot) {
        console.error('Bot实例未找到');
        return;
      }
      await bot.telegram.sendMessage(ctx, message, options);
    } else {
      // 如果是Context对象
      await ctx.reply(message, options);
    }
  } catch (error) {
    console.error('发送消息失败:', error);
  }
}

/**
 * 安全发送图片，处理错误
 * @param ctx 聊天上下文或ID
 * @param photoUrl 图片URL或文件ID
 * @param caption 图片说明
 * @param options 发送选项
 */
export async function safeSendPhoto(ctx: Context | string, photoUrl: string, caption?: string, options?: any): Promise<void> {
  try {
    if (typeof ctx === 'string') {
      // 如果是字符串ID，获取bot实例
      const bot = (global as any).bot as Telegraf;
      if (!bot) {
        console.error('Bot实例未找到');
        return;
      }
      await bot.telegram.sendPhoto(ctx, photoUrl, { caption, ...options });
    } else {
      // 如果是Context对象
      await ctx.replyWithPhoto(photoUrl, { caption, ...options });
    }
  } catch (error) {
    console.error('发送图片失败:', error);
    // 如果发送图片失败，尝试发送文本消息
    await safeSendMessage(ctx, `无法发送图片: ${photoUrl}\n${caption || ''}`, options);
  }
}

/**
 * 删除消息
 * @param ctx 聊天上下文
 * @param messageId 消息ID
 */
export async function safeDeleteMessage(ctx: Context, messageId?: number): Promise<void> {
  try {
    const msgId = messageId || ctx.message?.message_id;
    if (msgId && ctx.chat?.id) {
      await ctx.telegram.deleteMessage(ctx.chat.id, msgId);
    }
  } catch (error) {
    console.error('删除消息失败:', error);
  }
} 
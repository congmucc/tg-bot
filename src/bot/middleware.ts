import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';

/**
 * 为机器人设置中间件
 * @param bot Telegraf机器人实例
 */
export function setupMiddleware(bot: Telegraf) {
  // 记录消息中间件
  bot.use(async (ctx, next) => {
    const start = Date.now();
    try {
      await next(); // 处理请求
    } finally {
      const ms = Date.now() - start;
      const username = ctx.from?.username || ctx.from?.first_name || 'unknown';
      const chatType = ctx.chat?.type || 'unknown';
      console.log(`[${new Date().toISOString()}] ${chatType} @${username}: ${ms}ms`);
    }
  });
  
  // 处理请求速率限制
  const userRequestCounts = new Map<number, { count: number; timestamp: number }>();
  bot.use(async (ctx, next) => {
    if (!ctx.from) return await next();
    
    const userId = ctx.from.id;
    const now = Date.now();
    const userRequests = userRequestCounts.get(userId) || { count: 0, timestamp: now };
    
    // 重置60秒前的计数
    if (now - userRequests.timestamp > 60000) {
      userRequests.count = 0;
      userRequests.timestamp = now;
    }
    
    // 超过每分钟10个请求则拦截
    if (userRequests.count > 10) {
      return await ctx.reply('请求过于频繁，请稍后再试');
    }
    
    // 增加用户请求计数
    userRequests.count++;
    userRequestCounts.set(userId, userRequests);
    
    await next();
  });
  
  // 处理不支持的消息类型
  bot.on(message('sticker'), (ctx) => ctx.reply('很有意思的贴纸，但我看不懂...'));
  bot.on(message('audio'), (ctx) => ctx.reply('抱歉，我不能处理音频消息'));
  bot.on(message('video'), (ctx) => ctx.reply('抱歉，我不能处理视频消息'));
  bot.on(message('document'), (ctx) => ctx.reply('抱歉，我不能处理文档'));
  
  // 过滤器: 仅对私聊或机器人是管理员的群组消息作出响应
  bot.use(async (ctx, next) => {
    // 如果是私聊或频道消息，直接处理
    if (ctx.chat?.type === 'private' || ctx.chat?.type === 'channel') {
      return await next();
    }
    
    // 如果是群组消息，检查机器人是否为管理员
    if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
      try {
        const admins = await ctx.getChatAdministrators();
        const botId = ctx.botInfo.id;
        const isAdmin = admins.some(admin => admin.user.id === botId);
        
        if (!isAdmin) {
          // 机器人不是管理员，只响应提及机器人的消息
          const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
          const botUsername = ctx.botInfo.username;
          
          if (botUsername && messageText && messageText.includes(`@${botUsername}`)) {
            return await next();
          }
          return;
        }
      } catch (error) {
        console.error('获取管理员列表失败', error);
        return;
      }
    }
    
    await next();
  });
} 
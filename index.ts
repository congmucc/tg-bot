import TelegramBot, { Message } from 'node-telegram-bot-api';
import axios, { AxiosResponse } from 'axios';
import cron from 'node-cron';
import dotenv from 'dotenv';
dotenv.config();
// 环境变量类型声明
interface EnvConfig {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}


// 从环境变量获取配置（实际使用时建议使用dotenv）
const config: EnvConfig = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '', // 替换为你的机器人token
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || ''    // 替换为你的频道ID（带-100前缀）
};


// 创建Telegram机器人实例
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
  polling: false // 非轮询模式，仅用于发送消息
});

// 定义API响应类型
interface FNGResponse {
  name: string;
  data: {
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update: string;
  }[];
}

// 获取恐惧贪婪指数
async function fetchFearAndGreed(): Promise<FNGResponse> {
  try {
    const response: AxiosResponse<FNGResponse> = await axios.get(
      'https://api.alternative.me/fng/'
    );
    return response.data;
  } catch (error) {
    throw new Error(`API请求失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// 发送消息到Telegram
async function sendTelegramMessage(message: string): Promise<Message> {
  try {
    return await bot.sendMessage(config.TELEGRAM_CHAT_ID, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  } catch (error) {
    const err = error as Error;
    if (err.message.includes('ETIMEDOUT')) {
      throw new Error('连接Telegram API超时，请检查网络或使用代理');
    }
    throw new Error(`消息发送失败: ${err.message}`);
  }
}

// 主执行函数
async function main() {
  try {
    console.log('开始获取恐惧贪婪指数...');
    const fngData = await fetchFearAndGreed();
    
    if (fngData.data.length === 0) {
      throw new Error('未获取到有效数据');
    }

    const current = fngData.data[0];
    const message = `
📈 *加密货币市场情绪报告*
---------------------
🪙 当前指数: *${current.value}*
😨😋 情绪: *${current.value_classification}*
🕒 更新时间: ${new Date(parseInt(current.timestamp) * 1000).toLocaleString()}
    `;

    console.log('开始发送Telegram消息...');
    const result = await sendTelegramMessage(message);
    console.log(`消息发送成功! 消息ID: ${result.message_id}`);
    
  } catch (error) {
    const err = error as Error;
    console.error('❌ 错误:', err.message);
    
    // 尝试发送错误通知
    try {
      await sendTelegramMessage(`⚠️ 机器人运行错误: ${err.message.slice(0, 1000)}`);
    } catch (telegramError) {
      console.error('连错误消息也无法发送:', telegramError);
    }
  }
}

// 启动程序
main();

cron.schedule('0 19 * * *', () => {
  main();
  console.log('定时发送成功');
});
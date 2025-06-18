// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = 'test_token';
process.env.TELEGRAM_CHAT_ID = 'test_chat_id';
process.env.WHALE_MONITOR_ENABLED = 'false';
process.env.WHALE_MONITOR_INTERVAL = '30';
process.env.WHALE_MONITOR_COOLDOWN = '10';
process.env.WHALE_MONITOR_BATCH_SIZE = '5';
process.env.PORT = '3000';

// 禁用控制台输出以保持测试输出清洁
if (process.env.JEST_SILENT !== 'false') {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

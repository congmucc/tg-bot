import { Telegraf, Context } from 'telegraf';
import { handleStartCommand } from './start';
import { handlePriceCommand } from './price';
import { handleLiquidityCommand } from './liquidity';
import { handleWhaleCommand } from './whale';
import { handleFearCommand } from './fear';
import { handleCompareCommand } from './compare';

import { handleTradeCommand } from './trade';
import { handleTrendCommand } from './trend';
import { handleTrackCommand } from './track';
import { handleHelpCommand } from './help';

/**
 * 注册所有命令处理函数
 * @param bot Telegraf机器人实例
 */
export function registerCommands(bot: Telegraf) {
  // 注册开始命令
  bot.command('start', handleStartCommand);

  // 注册价格查询命令
  bot.command('price', handlePriceCommand);
  
  // 注册流动性分析命令
  bot.command('liquidity', handleLiquidityCommand);
  
  // 注册鲸鱼监控命令
  bot.command('whale', handleWhaleCommand);
  
  // 注册恐惧贪婪指数命令
  bot.command('fear', handleFearCommand);
  
  // 注册价格比较命令
  bot.command('compare', handleCompareCommand);
  
  
  // 注册智能交易命令
  bot.command('trade', handleTradeCommand);
  
  // 注册市场趋势预测命令
  bot.command('trend', handleTrendCommand);

  // 注册钱包跟踪命令
  bot.command('track', handleTrackCommand);
  
  // 注册帮助命令
  bot.command('help', handleHelpCommand);
  
  // 设置命令菜单
  bot.telegram.setMyCommands([
    { command: 'start', description: '开始使用机器人' },
    { command: 'price', description: '查询代币价格' },
    { command: 'compare', description: '交易平台价格聚合' },
    { command: 'liquidity', description: '分析流动性' },
    { command: 'whale', description: '监控大额交易' },
    { command: 'fear', description: '恐惧贪婪指数' },
    { command: 'trade', description: '智能交易建议' },
    { command: 'trend', description: '市场趋势预测' },
    { command: 'track', description: '跟踪钱包资产' },
    { command: 'help', description: '显示帮助信息' },
  ]).catch(err => console.error('设置命令菜单失败:', err.message));
}

export {
  handleStartCommand,
  handlePriceCommand,
  handleLiquidityCommand,
  handleWhaleCommand,
  handleFearCommand,
  handleCompareCommand,
  handleTradeCommand,
  handleTrendCommand,
  handleTrackCommand,
  handleHelpCommand
};
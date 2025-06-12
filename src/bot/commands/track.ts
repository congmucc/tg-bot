import { Context } from 'telegraf';
import ethereumAPI from '../../api/blockchain/ethereum';
import solanaAPI from '../../api/blockchain/solana';
import { isValidEthereumAddress, isValidSolanaAddress, shortenAddress } from '../../utils';

// 存储用户跟踪的钱包（真实应用应使用数据库）
interface TrackedWallet {
  id: string;
  userId: number;
  address: string;
  chain: 'ethereum' | 'solana';
  name: string;
  createdAt: Date;
}

const trackedWallets: TrackedWallet[] = [];

/**
 * 生成唯一钱包ID
 */
function generateWalletId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * 处理钱包跟踪命令
 * @param ctx Telegraf上下文
 */
export async function handleTrackCommand(ctx: Context): Promise<void> {
  await ctx.sendChatAction('typing');
  
  const message = ctx.message;
  // 确保消息是文本消息
  if (!message || !('text' in message)) {
    await ctx.reply('无法处理此类消息');
    return;
  }
  
  // 解析命令参数
  const args = message.text.split(' ').filter(arg => arg.trim() !== '');
  
  // 处理命令选项
  if (args.length === 1 || args[1] === 'help') {
    await ctx.replyWithMarkdown(
      `*钱包跟踪功能*\n\n` +
      `添加以太坊钱包: /track eth [钱包地址] [备注名称]\n` +
      `添加Solana钱包: /track sol [钱包地址] [备注名称]\n` +
      `查看已跟踪钱包: /track list\n` +
      `查看钱包详情: /track view [钱包ID]\n` +
      `删除跟踪钱包: /track delete [钱包ID]\n` +
      `清除所有钱包: /track clear`
    );
    return;
  }
  
  // 列出当前用户的所有跟踪钱包
  if (args[1] === 'list') {
    return listTrackedWallets(ctx);
  }
  
  // 查看特定钱包详情
  if (args[1] === 'view' && args.length > 2) {
    return viewWalletDetails(ctx, args[2]);
  }
  
  // 删除特定钱包
  if (args[1] === 'delete' && args.length > 2) {
    return deleteWallet(ctx, args[2]);
  }
  
  // 清除当前用户的所有跟踪钱包
  if (args[1] === 'clear') {
    return clearTrackedWallets(ctx);
  }
  
  // 添加新钱包跟踪
  if ((args[1] === 'eth' || args[1] === 'sol') && args.length >= 3) {
    const chain = args[1] === 'eth' ? 'ethereum' : 'solana';
    const address = args[2];
    const name = args.slice(3).join(' ') || `${chain}-wallet-${trackedWallets.length + 1}`;
    
    return addWalletToTrack(ctx, chain, address, name);
  }
  
  await ctx.reply('参数不正确。使用 /track help 查看帮助。');
}

/**
 * 添加钱包到跟踪列表
 * @param ctx Telegraf上下文
 * @param chain 区块链
 * @param address 钱包地址
 * @param name 备注名称
 */
async function addWalletToTrack(ctx: Context, chain: 'ethereum' | 'solana', address: string, name: string): Promise<void> {
  const userId = ctx.from?.id || 0;
  
  // 验证地址格式
  let isValid = false;
  if (chain === 'ethereum') {
    isValid = isValidEthereumAddress(address);
  } else {
    isValid = isValidSolanaAddress(address);
  }
  
  if (!isValid) {
    await ctx.reply(`无效的${chain === 'ethereum' ? '以太坊' : 'Solana'}地址格式`);
    return;
  }
  
  // 检查是否已经跟踪该钱包
  const existing = trackedWallets.find(
    wallet => wallet.userId === userId && wallet.address.toLowerCase() === address.toLowerCase() && wallet.chain === chain
  );
  
  if (existing) {
    await ctx.reply(`您已经在跟踪此${chain === 'ethereum' ? '以太坊' : 'Solana'}钱包`);
    return;
  }
  
  try {
    // 尝试获取钱包余额以验证地址有效
    let balanceValue: string;
    let symbol: string;
    
    if (chain === 'ethereum') {
      const balance = await ethereumAPI.getAccountBalance(address);
      balanceValue = balance.ethBalance;
      symbol = 'ETH';
    } else {
      const balance = await solanaAPI.getAccountBalance(address);
      balanceValue = balance.solBalance;
      symbol = 'SOL';
    }
    
    // 添加到跟踪列表
    const walletId = generateWalletId();
    
    trackedWallets.push({
      id: walletId,
      userId,
      address,
      chain,
      name,
      createdAt: new Date()
    });
    
    const explorerUrl = chain === 'ethereum' 
      ? `https://etherscan.io/address/${address}`
      : `https://solscan.io/account/${address}`;
    
    await ctx.replyWithMarkdown(
      `✅ *钱包已添加到跟踪列表*\n` +
      `---------------------\n` +
      `🔍 跟踪ID: \`${walletId}\`\n` +
      `📝 备注名称: ${name}\n` +
      `💼 地址: [${shortenAddress(address)}](${explorerUrl})\n` +
      `💰 当前余额: ${balanceValue} ${symbol}\n\n` +
      `_使用 /track view ${walletId} 查看详情_`
    );
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`添加钱包跟踪失败: ${err.message}`);
  }
}

/**
 * 列出用户跟踪的所有钱包
 * @param ctx Telegraf上下文
 */
async function listTrackedWallets(ctx: Context): Promise<void> {
  const userId = ctx.from?.id || 0;
  const userWallets = trackedWallets.filter(wallet => wallet.userId === userId);
  
  if (userWallets.length === 0) {
    await ctx.reply('您当前没有跟踪任何钱包');
    return;
  }
  
  let message = `*您跟踪的钱包列表*\n---------------------\n`;
  
  // 分类显示不同链的钱包
  const ethWallets = userWallets.filter(wallet => wallet.chain === 'ethereum');
  const solWallets = userWallets.filter(wallet => wallet.chain === 'solana');
  
  if (ethWallets.length > 0) {
    message += `\n*以太坊钱包*:\n`;
    ethWallets.forEach(wallet => {
      message += `📝 ${wallet.name} - \`${wallet.id}\`\n`;
      message += `💼 [${shortenAddress(wallet.address)}](https://etherscan.io/address/${wallet.address})\n`;
      message += `---------------------\n`;
    });
  }
  
  if (solWallets.length > 0) {
    message += `\n*Solana钱包*:\n`;
    solWallets.forEach(wallet => {
      message += `📝 ${wallet.name} - \`${wallet.id}\`\n`;
      message += `💼 [${shortenAddress(wallet.address)}](https://solscan.io/account/${wallet.address})\n`;
      message += `---------------------\n`;
    });
  }
  
  message += `\n_使用 /track view [ID] 查看详情_\n`;
  message += `_使用 /track delete [ID] 删除特定钱包_`;
  
  await ctx.replyWithMarkdown(message);
}

/**
 * 查看钱包详细信息
 * @param ctx Telegraf上下文
 * @param walletId 钱包ID
 */
async function viewWalletDetails(ctx: Context, walletId: string): Promise<void> {
  const userId = ctx.from?.id || 0;
  
  const wallet = trackedWallets.find(w => 
    w.id === walletId && w.userId === userId
  );
  
  if (!wallet) {
    await ctx.reply('未找到该钱包，或者不属于您');
    return;
  }
  
  try {
    await ctx.reply(`正在获取${wallet.chain === 'ethereum' ? '以太坊' : 'Solana'}钱包信息...`);
    
    let message = `*钱包详细信息*\n---------------------\n`;
    message += `📝 名称: ${wallet.name}\n`;
    
    const explorerUrl = wallet.chain === 'ethereum' 
      ? `https://etherscan.io/address/${wallet.address}`
      : `https://solscan.io/account/${wallet.address}`;
    
    message += `💼 地址: [${wallet.address}](${explorerUrl})\n`;
    message += `⛓ 网络: ${wallet.chain === 'ethereum' ? '以太坊' : 'Solana'}\n`;
    
    // 获取余额信息
    if (wallet.chain === 'ethereum') {
      const balance = await ethereumAPI.getAccountBalance(wallet.address);
      message += `\n*余额信息*\n`;
      message += `💰 ETH: ${balance.ethBalance}\n`;
      if (balance.usdValue) {
        message += `💵 价值: $${balance.usdValue.toFixed(2)}\n`;
      }
      
      // 获取前5个代币余额
      try {
        const tokens = await ethereumAPI.getTokenBalance(wallet.address, '');
        if (tokens) {
          message += `\n*代币余额*\n`;
          message += `${tokens.tokenSymbol}: ${tokens.balance}\n`;
        }
      } catch (error) {
        message += `\n获取代币余额失败\n`;
      }
    } else {
      const balance = await solanaAPI.getAccountBalance(wallet.address);
      message += `\n*余额信息*\n`;
      message += `💰 SOL: ${balance.solBalance}\n`;
      if (balance.usdValue) {
        message += `💵 价值: $${balance.usdValue.toFixed(2)}\n`;
      }
      
      // 可以在这里添加Solana代币余额获取逻辑
    }
    
    message += `\n_使用 /track delete ${wallet.id} 删除此钱包_`;
    
    await ctx.replyWithMarkdown(message);
  } catch (error) {
    const err = error as Error;
    await ctx.reply(`获取钱包信息失败: ${err.message}`);
  }
}

/**
 * 删除特定钱包
 * @param ctx Telegraf上下文
 * @param walletId 钱包ID
 */
async function deleteWallet(ctx: Context, walletId: string): Promise<void> {
  const userId = ctx.from?.id || 0;
  
  const walletIndex = trackedWallets.findIndex(wallet => 
    wallet.id === walletId && wallet.userId === userId
  );
  
  if (walletIndex === -1) {
    await ctx.reply('未找到该钱包，或者不属于您');
    return;
  }
  
  const wallet = trackedWallets[walletIndex];
  trackedWallets.splice(walletIndex, 1);
  
  await ctx.replyWithMarkdown(
    `✅ 已删除钱包: ${wallet.name}\n` +
    `地址: ${shortenAddress(wallet.address)}`
  );
}

/**
 * 清除用户的所有跟踪钱包
 * @param ctx Telegraf上下文
 */
async function clearTrackedWallets(ctx: Context): Promise<void> {
  const userId = ctx.from?.id || 0;
  
  const userWalletCount = trackedWallets.filter(wallet => 
    wallet.userId === userId
  ).length;
  
  if (userWalletCount === 0) {
    await ctx.reply('您当前没有跟踪任何钱包');
    return;
  }
  
  // 删除所有属于该用户的钱包
  let count = 0;
  for (let i = trackedWallets.length - 1; i >= 0; i--) {
    if (trackedWallets[i].userId === userId) {
      trackedWallets.splice(i, 1);
      count++;
    }
  }
  
  await ctx.replyWithMarkdown(
    `✅ 已清除所有 ${count} 个跟踪钱包`
  );
} 
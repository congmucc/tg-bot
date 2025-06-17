import WebSocket from 'ws';
import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { Telegraf } from 'telegraf';
import { API_CONFIG, BOT_CONFIG } from '../config/env';
import { formatAmount, shortenAddress } from '../utils/format';

// 创建bot实例用于发送消息
const bot = new Telegraf(BOT_CONFIG.TELEGRAM_BOT_TOKEN);

/**
 * 发送消息到Telegram频道
 */
async function sendToChannel(channelId: string, message: string, options?: any): Promise<boolean> {
  try {
    await bot.telegram.sendMessage(channelId, message, options);
    return true;
  } catch (error) {
    const err = error as Error;
    console.error(`发送消息到频道失败: ${err.message}`);
    return false;
  }
}

/**
 * WebSocket监听服务
 * 用于实时监听各链的大额交易
 */
class WebSocketMonitor {
  private solanaConnection: Connection;
  private ethereumProvider: ethers.providers.WebSocketProvider | null = null;
  private hyperliquidWs: WebSocket | null = null;
  private bitcoinCheckInterval: NodeJS.Timeout | null = null;
  private solanaSlotSubscription: number | null = null;
  private solanaAccountSubscription: number | null = null;
  private isMonitoring = false;
  private transactionCache = new Set<string>();
  private readonly CACHE_MAX_SIZE = 1000;

  // 监控阈值 (大额交易监控)
  private thresholds = {
    ethereum: 50,     // 50 ETH (~$125,000)
    solana: 500,      // 500 SOL (~$75,000)
    bitcoin: 5,       // 5 BTC (~$325,000)
    hyperliquid: 50000 // $50,000
  };

  // 合约交易监控阈值
  private contractThresholds = {
    ethereum: 25000,    // $25,000 USD
    solana: 15000,      // $15,000 USD
    hyperliquid: 25000  // $25,000 USD
  };

  constructor() {
    this.solanaConnection = new Connection(API_CONFIG.SOLANA_RPC_URL, 'confirmed');
  }

  /**
   * 启动WebSocket监听
   */
  public async startMonitoring(): Promise<boolean> {
    if (this.isMonitoring) {
      console.log('WebSocket监听已在运行中');
      return false;
    }

    try {
      console.log('🚀 启动WebSocket实时监听...');
      this.isMonitoring = true;

      // 启动各链监听
      await Promise.all([
        this.startSolanaMonitoring(),
        this.startEthereumMonitoring(),
        this.startHyperliquidMonitoring(),
        this.startBitcoinMonitoring()
      ]);

      console.log('✅ 所有WebSocket监听已启动');
      return true;
    } catch (error) {
      console.error('启动WebSocket监听失败:', error);
      this.isMonitoring = false;
      return false;
    }
  }

  /**
   * 停止WebSocket监听
   */
  public stopMonitoring(): boolean {
    if (!this.isMonitoring) {
      return false;
    }

    console.log('🛑 停止WebSocket监听...');
    this.isMonitoring = false;

    // 关闭Solana监听
    if (this.solanaSlotSubscription !== null) {
      try {
        this.solanaConnection.removeSlotChangeListener(this.solanaSlotSubscription);
        this.solanaSlotSubscription = null;
        console.log('✅ Solana slot监听已停止');
      } catch (error) {
        console.warn('停止Solana slot监听失败:', error);
      }
    }

    if (this.solanaAccountSubscription !== null) {
      try {
        this.solanaConnection.removeAccountChangeListener(this.solanaAccountSubscription);
        this.solanaAccountSubscription = null;
        console.log('✅ Solana账户监听已停止');
      } catch (error) {
        console.warn('停止Solana账户监听失败:', error);
      }
    }

    // 关闭以太坊连接
    if (this.ethereumProvider) {
      this.ethereumProvider.removeAllListeners();
      this.ethereumProvider = null;
      console.log('✅ 以太坊监听已停止');
    }

    // 关闭Hyperliquid连接
    if (this.hyperliquidWs) {
      this.hyperliquidWs.close();
      this.hyperliquidWs = null;
      console.log('✅ Hyperliquid监听已停止');
    }

    // 停止比特币轮询
    if (this.bitcoinCheckInterval) {
      clearInterval(this.bitcoinCheckInterval);
      this.bitcoinCheckInterval = null;
      console.log('✅ 比特币监听已停止');
    }

    console.log('✅ WebSocket监听已停止');
    return true;
  }

  /**
   * 启动Solana监听
   */
  private async startSolanaMonitoring(): Promise<void> {
    try {
      console.log('🔗 启动Solana WebSocket监听...');
      
      // 监听账户变化（大额转账）
      this.solanaAccountSubscription = this.solanaConnection.onAccountChange(
        new PublicKey('11111111111111111111111111111112'), // System Program
        async (_accountInfo, _context) => {
          // 这里可以监听特定账户的变化
        },
        'confirmed'
      );

      // 监听新区块，使用更保守的方法
      this.solanaSlotSubscription = this.solanaConnection.onSlotChange((slotInfo) => {
        if (this.isMonitoring && slotInfo.slot % 20 === 0) { // 每20个slot检查一次，减少频率
          // 延迟一点时间等待区块确认
          setTimeout(() => {
            if (this.isMonitoring) { // 再次检查是否还在监听
              this.checkSolanaTransactions(slotInfo.slot - 5); // 检查稍早的区块
            }
          }, 2000);
        }
      });

      console.log('✅ Solana WebSocket监听已启动');
    } catch (error) {
      console.error('Solana WebSocket监听启动失败:', error);
    }
  }

  /**
   * 检查Solana交易
   */
  private async checkSolanaTransactions(slot: number): Promise<void> {
    try {
      const block = await this.solanaConnection.getBlock(slot, {
        maxSupportedTransactionVersion: 0
      });

      if (!block || !block.transactions) return;

      for (const tx of block.transactions) {
        if (!tx.meta || tx.meta.err) continue;

        const signature = tx.transaction.signatures[0];

        // 检查现货大额交易
        const preBalances = tx.meta.preBalances;
        const postBalances = tx.meta.postBalances;

        if (preBalances && postBalances && preBalances.length === postBalances.length) {
          for (let i = 0; i < preBalances.length; i++) {
            const balanceChange = Math.abs(postBalances[i] - preBalances[i]);
            const solValue = balanceChange / 1e9; // LAMPORTS_PER_SOL

            if (solValue >= this.thresholds.solana) {
              console.log(`🔍 检测到Solana大额现货交易: ${solValue} SOL, 签名: ${signature}`);

              if (!this.transactionCache.has(signature)) {
                console.log(`📤 发送Solana现货警报: ${solValue} SOL`);
                await this.sendSolanaAlert(signature, solValue, slot);
                this.addToCache(signature);
              } else {
                console.log(`⚠️ Solana现货交易已缓存，跳过: ${signature}`);
              }
            }
          }
        }

        // 检查合约交易 (DeFi协议)
        await this.checkSolanaContractTransaction(tx, signature, slot);
      }
    } catch (error) {
      console.warn('检查Solana交易失败:', error);
    }
  }

  /**
   * 检查Solana合约交易 (DeFi协议)
   */
  private async checkSolanaContractTransaction(tx: any, signature: string, slot: number): Promise<void> {
    try {
      if (!tx.transaction || !tx.transaction.message || !tx.transaction.message.instructions) {
        return;
      }

      // 主要DeFi协议程序ID
      const defiPrograms: { [key: string]: string } = {
        // Mango Markets
        'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68': 'Mango Markets',

        // Drift Protocol
        'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH': 'Drift Protocol',

        // Solend
        'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo': 'Solend',

        // Serum DEX
        '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin': 'Serum DEX',

        // Jupiter
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter'
      };

      for (const instruction of tx.transaction.message.instructions) {
        const programId = tx.transaction.message.accountKeys[instruction.programIdIndex];
        const protocolName = defiPrograms[programId];

        if (protocolName) {
          await this.analyzeSolanaContractInstruction(instruction, tx, signature, slot, protocolName);
        }
      }

    } catch (error) {
      console.warn('检查Solana合约交易失败:', error);
    }
  }

  /**
   * 分析Solana合约指令
   */
  private async analyzeSolanaContractInstruction(
    instruction: any,
    tx: any,
    signature: string,
    slot: number,
    protocolName: string
  ): Promise<void> {
    try {
      // 简化的指令分析 - 实际应用中需要解析具体的指令数据
      const instructionData = instruction.data;

      // 根据指令数据的前几个字节判断操作类型
      let action = '合约操作';
      let actionIcon = '🔄';

      if (instructionData && instructionData.length > 0) {
        const firstByte = instructionData[0];

        // 这是简化的判断逻辑，实际需要根据具体协议的指令格式
        if (firstByte === 0 || firstByte === 1) {
          action = '开仓';
          actionIcon = '📈🟢';
        } else if (firstByte === 2 || firstByte === 3) {
          action = '平仓';
          actionIcon = '📉🔴';
        } else if (firstByte === 4 || firstByte === 5) {
          action = '交易';
          actionIcon = '💱';
        }
      }

      // 估算交易价值 (基于SOL余额变化)
      const preBalances = tx.meta?.preBalances || [];
      const postBalances = tx.meta?.postBalances || [];
      let totalValueChange = 0;

      for (let i = 0; i < Math.min(preBalances.length, postBalances.length); i++) {
        const balanceChange = Math.abs(postBalances[i] - preBalances[i]);
        totalValueChange += balanceChange / 1e9; // LAMPORTS_PER_SOL
      }

      const estimatedValue = totalValueChange * 150; // 假设SOL价格$150

      if (estimatedValue >= this.contractThresholds.solana) {
        const contractTxId = `SOL-CONTRACT-${signature}`;

        if (!this.transactionCache.has(contractTxId)) {
          console.log(`🚨 检测到Solana大额合约交易: ${protocolName} ${action} ~$${formatAmount(estimatedValue)}`);
          await this.sendSolanaContractAlert(signature, protocolName, action, estimatedValue, slot);
          this.addToCache(contractTxId);
        }
      }

    } catch (error) {
      console.warn('分析Solana合约指令失败:', error);
    }
  }

  /**
   * 启动以太坊监听
   */
  private async startEthereumMonitoring(): Promise<void> {
    try {
      console.log('🔗 启动以太坊WebSocket监听...');
      
      const wsUrl = API_CONFIG.ETHEREUM_WS_URL || API_CONFIG.ETHEREUM_RPC_URL.replace('https://', 'wss://');
      this.ethereumProvider = new ethers.providers.WebSocketProvider(wsUrl);

      // 监听新区块
      this.ethereumProvider.on('block', async (blockNumber) => {
        console.log(`🔍 检查以太坊区块: ${blockNumber}`);
        await this.checkEthereumTransactions(blockNumber);
      });

      console.log('✅ 以太坊WebSocket监听已启动');
    } catch (error) {
      console.error('以太坊WebSocket监听启动失败:', error);
    }
  }

  /**
   * 检查以太坊交易
   */
  private async checkEthereumTransactions(blockNumber: number): Promise<void> {
    try {
      if (!this.ethereumProvider) return;

      const block = await this.ethereumProvider.getBlockWithTransactions(blockNumber);
      if (!block || !block.transactions) return;

      const minValueInWei = ethers.utils.parseEther(this.thresholds.ethereum.toString());

      for (const tx of block.transactions) {
        // 检查现货大额交易
        if (ethers.BigNumber.from(tx.value).gte(minValueInWei)) {
          const ethValue = ethers.utils.formatEther(tx.value);
          console.log(`🔍 检测到以太坊大额现货交易: ${ethValue} ETH, 哈希: ${tx.hash}`);

          if (!this.transactionCache.has(tx.hash)) {
            console.log(`📤 发送以太坊现货警报: ${ethValue} ETH`);
            await this.sendEthereumAlert(tx.hash, ethValue, tx.from, tx.to || 'Contract Creation');
            this.addToCache(tx.hash);
          } else {
            console.log(`⚠️ 以太坊现货交易已缓存，跳过: ${tx.hash}`);
          }
        }

        // 检查合约交易 (DeFi协议)
        if (tx.to && tx.data && tx.data !== '0x') {
          await this.checkEthereumContractTransaction(tx);
        }
      }
    } catch (error) {
      console.warn('检查以太坊交易失败:', error);
    }
  }

  /**
   * 检查以太坊合约交易 (DeFi协议)
   */
  private async checkEthereumContractTransaction(tx: any): Promise<void> {
    try {
      if (!this.ethereumProvider) return;

      // 主要DeFi协议合约地址
      const defiProtocols: { [key: string]: string } = {
        // Perpetual协议
        '0x82ac2ce43e33683c58be4cdc40975e73aa50f459': 'Perpetual Protocol',
        '0x8c8d8f3f8f3f8f3f8f3f8f3f8f3f8f3f8f3f8f3f': 'dYdX',
        '0x489ee077994b6658eafa855c308275ead8097c4a': 'GMX',

        // Compound
        '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b': 'Compound',

        // Aave
        '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'Aave',

        // Uniswap V3
        '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',

        // 1inch
        '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch'
      };

      const protocolName = defiProtocols[tx.to.toLowerCase()];
      if (!protocolName) return;

      // 获取交易收据以分析事件日志
      const receipt = await this.ethereumProvider.getTransactionReceipt(tx.hash);
      if (!receipt || !receipt.logs) return;

      // 分析日志以检测开仓/平仓操作
      for (const log of receipt.logs) {
        await this.analyzeEthereumContractLog(log, tx, protocolName);
      }

    } catch (error) {
      console.warn('检查以太坊合约交易失败:', error);
    }
  }

  /**
   * 分析以太坊合约日志
   */
  private async analyzeEthereumContractLog(log: any, tx: any, protocolName: string): Promise<void> {
    try {
      // 常见的开仓/平仓事件签名
      const eventSignatures: { [key: string]: string } = {
        // Perpetual Protocol
        '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1': 'PositionOpened',
        '0x2fe5be0146f74c5bce36c0b80911af6c7d86ff27e89d5cfa61fc681327954e5d': 'PositionClosed',

        // GMX
        '0x93d75d64d1f84fc6f430a64fc578bdd4c1e090e90ea2d51773e626d19de56d30': 'IncreasePosition',
        '0x0f20e553a6bbf21378e84c7df0fb9f4f5307b5cd2b6e2b5e5b5e5b5e5b5e5b5e': 'DecreasePosition',

        // dYdX
        '0x6ff4ac6d4e9e9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b': 'Trade'
      };

      const eventName = eventSignatures[log.topics[0]];
      if (!eventName) return;

      // 估算交易价值 (简化计算)
      const gasUsed = tx.gasLimit ? ethers.BigNumber.from(tx.gasLimit) : ethers.BigNumber.from('21000');
      const gasPrice = tx.gasPrice ? ethers.BigNumber.from(tx.gasPrice) : ethers.BigNumber.from('20000000000');
      const txValue = ethers.utils.formatEther(tx.value || '0');

      // 如果是大额合约交易
      const estimatedValue = parseFloat(txValue) * 2500; // 假设ETH价格$2500

      if (estimatedValue >= this.contractThresholds.ethereum) {
        const contractTxId = `ETH-CONTRACT-${tx.hash}`;

        if (!this.transactionCache.has(contractTxId)) {
          console.log(`🚨 检测到以太坊大额合约交易: ${protocolName} ${eventName} ~$${formatAmount(estimatedValue)}`);
          await this.sendEthereumContractAlert(tx, protocolName, eventName, estimatedValue);
          this.addToCache(contractTxId);
        }
      }

    } catch (error) {
      console.warn('分析以太坊合约日志失败:', error);
    }
  }

  /**
   * 启动Hyperliquid监听
   */
  private async startHyperliquidMonitoring(): Promise<void> {
    try {
      console.log('🔗 启动Hyperliquid WebSocket监听...');
      
      this.hyperliquidWs = new WebSocket('wss://api.hyperliquid.xyz/ws');

      this.hyperliquidWs.on('open', () => {
        console.log('✅ Hyperliquid WebSocket连接已建立');

        // 订阅所有交易数据 - 使用Hyperliquid的正确格式
        if (this.hyperliquidWs) {
          this.hyperliquidWs.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'allMids'
            }
          }));

          // 订阅交易数据
          this.hyperliquidWs.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'trades',
              coin: '@0' // 订阅所有币种
            }
          }));

          // 订阅用户状态更新 (包含开仓/平仓信息)
          this.hyperliquidWs.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'userEvents',
              user: 'all' // 监听所有用户事件
            }
          }));

          // 订阅订单簿更新
          this.hyperliquidWs.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'l2Book',
              coin: '@0'
            }
          }));
        }
      });

      this.hyperliquidWs.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.channel === 'trades' && message.data && Array.isArray(message.data)) {
            // 处理现货交易数据
            for (const trade of message.data) {
              await this.processHyperliquidTrade(trade);
            }
          } else if (message.channel === 'userEvents' && message.data) {
            // 处理用户事件 (开仓/平仓)
            await this.processHyperliquidUserEvents(message.data);
          } else if (message.channel === 'subscriptionResponse') {
            console.log('✅ Hyperliquid订阅确认:', message.data);
          }
        } catch (error) {
          console.warn('处理Hyperliquid消息失败:', error);
        }
      });

      this.hyperliquidWs.on('error', (error) => {
        console.error('Hyperliquid WebSocket错误:', error);
      });

      this.hyperliquidWs.on('close', () => {
        console.log('Hyperliquid WebSocket连接已关闭');
        if (this.isMonitoring) {
          // 重连逻辑
          setTimeout(() => this.startHyperliquidMonitoring(), 5000);
        }
      });

    } catch (error) {
      console.error('Hyperliquid WebSocket监听启动失败:', error);
    }
  }

  /**
   * 处理Hyperliquid交易
   */
  private async processHyperliquidTrade(trade: any): Promise<void> {
    try {
      if (!trade || !trade.coin || !trade.sz || !trade.px) {
        return; // 跳过无效数据
      }

      const size = parseFloat(trade.sz);
      const price = parseFloat(trade.px);
      const coin = trade.coin;
      const side = trade.side === 'A' ? '买入' : (trade.side === 'B' ? '卖出' : '未知');
      const time = trade.time || Date.now();

      const value = size * price;

      console.log(`🔍 检测到Hyperliquid现货交易: ${coin} ${size} @ $${price} = $${value} (${side})`);

      if (value >= this.thresholds.hyperliquid) {
        const tradeId = `HL-SPOT-${coin}-${trade.tid || time}`;
        console.log(`🚨 检测到Hyperliquid大额现货交易: $${formatAmount(value)}, 币种: ${coin}`);

        if (!this.transactionCache.has(tradeId)) {
          console.log(`📤 发送Hyperliquid现货警报: $${formatAmount(value)}`);
          await this.sendHyperliquidAlert({
            ...trade,
            coin,
            side,
            sz: size,
            px: price,
            value,
            type: 'spot'
          }, value);
          this.addToCache(tradeId);
        } else {
          console.log(`⚠️ Hyperliquid现货交易已缓存，跳过: ${tradeId}`);
        }
      }
    } catch (error) {
      console.warn('处理Hyperliquid现货交易失败:', error);
      console.warn('交易数据:', JSON.stringify(trade, null, 2));
    }
  }

  /**
   * 处理Hyperliquid用户事件 (合约开仓/平仓)
   */
  private async processHyperliquidUserEvents(events: any): Promise<void> {
    try {
      if (!events || !Array.isArray(events)) {
        return;
      }

      for (const event of events) {
        if (event.type === 'fill' && event.data) {
          const fill = event.data;

          // 检查是否为合约交易
          if (fill.isPerp || fill.coin?.includes('-PERP') || fill.side === 'long' || fill.side === 'short') {
            await this.processHyperliquidContractTrade(fill);
          }
        } else if (event.type === 'liquidation' && event.data) {
          await this.processHyperliquidLiquidation(event.data);
        }
      }
    } catch (error) {
      console.warn('处理Hyperliquid用户事件失败:', error);
      console.warn('事件数据:', JSON.stringify(events, null, 2));
    }
  }

  /**
   * 处理Hyperliquid合约交易
   */
  private async processHyperliquidContractTrade(fill: any): Promise<void> {
    try {
      const size = parseFloat(fill.sz || '0');
      const price = parseFloat(fill.px || '0');
      const coin = fill.coin || 'Unknown';
      const side = fill.side; // 'long' 或 'short'
      const isOpen = fill.dir === 'Open Position' || fill.closedPnl === undefined;
      const time = fill.time || Date.now();

      const value = size * price;
      const action = isOpen ? (side === 'long' ? '开多' : '开空') : (side === 'long' ? '平多' : '平空');

      console.log(`🔍 检测到Hyperliquid合约交易: ${coin} ${action} ${size} @ $${price} = $${value}`);

      if (value >= this.contractThresholds.hyperliquid) {
        const tradeId = `HL-PERP-${coin}-${fill.tid || time}`;
        console.log(`🚨 检测到Hyperliquid大额合约交易: ${action} $${formatAmount(value)}, 币种: ${coin}`);

        if (!this.transactionCache.has(tradeId)) {
          console.log(`📤 发送Hyperliquid合约警报: ${action} $${formatAmount(value)}`);
          await this.sendHyperliquidContractAlert({
            ...fill,
            coin,
            side,
            action,
            sz: size,
            px: price,
            value,
            isOpen,
            type: 'contract'
          }, value);
          this.addToCache(tradeId);
        } else {
          console.log(`⚠️ Hyperliquid合约交易已缓存，跳过: ${tradeId}`);
        }
      }
    } catch (error) {
      console.warn('处理Hyperliquid合约交易失败:', error);
      console.warn('交易数据:', JSON.stringify(fill, null, 2));
    }
  }

  /**
   * 处理Hyperliquid清算事件
   */
  private async processHyperliquidLiquidation(liquidation: any): Promise<void> {
    try {
      const size = parseFloat(liquidation.sz || '0');
      const price = parseFloat(liquidation.px || '0');
      const coin = liquidation.coin || 'Unknown';
      const side = liquidation.side;
      const value = size * price;

      console.log(`🔍 检测到Hyperliquid清算: ${coin} ${side} ${size} @ $${price} = $${value}`);

      if (value >= this.contractThresholds.hyperliquid) {
        const liquidationId = `HL-LIQ-${coin}-${liquidation.time || Date.now()}`;

        if (!this.transactionCache.has(liquidationId)) {
          console.log(`📤 发送Hyperliquid清算警报: $${formatAmount(value)}`);
          await this.sendHyperliquidLiquidationAlert({
            ...liquidation,
            coin,
            side,
            sz: size,
            px: price,
            value
          }, value);
          this.addToCache(liquidationId);
        }
      }
    } catch (error) {
      console.warn('处理Hyperliquid清算失败:', error);
    }
  }

  /**
   * 发送Solana现货警报
   */
  private async sendSolanaAlert(signature: string, value: number, slot: number): Promise<void> {
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
    console.log(`📱 准备发送Solana现货警报到频道: ${channelId}`);

    if (!channelId) {
      console.error('❌ TELEGRAM_CHAT_ID 未配置，无法发送消息');
      return;
    }

    const message = `
🟣 *SOLANA 大额现货交易警报* 🟣
━━━━━━━━━━━━━━━━━━━━━
💰 金额: *${formatAmount(value)} SOL*
🔗 [查看交易](https://solscan.io/tx/${signature})
📦 区块: ${slot}
⏰ 时间: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━
🤖 *鲸鱼监控机器人*
`;

    const success = await sendToChannel(channelId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    if (success) {
      console.log(`✅ Solana现货警报发送成功: ${value} SOL`);
    } else {
      console.error(`❌ Solana现货警报发送失败`);
    }
  }

  /**
   * 发送Solana合约交易警报
   */
  private async sendSolanaContractAlert(
    signature: string,
    protocolName: string,
    action: string,
    estimatedValue: number,
    slot: number
  ): Promise<void> {
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
    console.log(`📱 准备发送Solana合约警报到频道: ${channelId}`);

    if (!channelId) {
      console.error('❌ TELEGRAM_CHAT_ID 未配置，无法发送消息');
      return;
    }

    // 根据操作类型确定图标
    let actionIcon = '🔄';
    if (action.includes('开仓')) {
      actionIcon = '📈🟢';
    } else if (action.includes('平仓')) {
      actionIcon = '📉🔴';
    } else if (action.includes('交易')) {
      actionIcon = '💱';
    }

    const message = `
🟣 *SOLANA 大额合约交易警报* 🟣
━━━━━━━━━━━━━━━━━━━━━
${actionIcon} 操作: *${action}*
🏛️ 协议: ${protocolName}
💰 估算金额: *~$${formatAmount(estimatedValue)}*
🔗 [查看交易](https://solscan.io/tx/${signature})
📦 区块: ${slot}
⏰ 时间: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━
🤖 *鲸鱼监控机器人*
`;

    const success = await sendToChannel(channelId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    if (success) {
      console.log(`✅ Solana合约警报发送成功: ${protocolName} ${action} ~$${estimatedValue}`);
    } else {
      console.error(`❌ Solana合约警报发送失败`);
    }
  }

  /**
   * 发送以太坊现货警报
   */
  private async sendEthereumAlert(hash: string, value: string, from: string, to: string): Promise<void> {
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
    console.log(`📱 准备发送以太坊现货警报到频道: ${channelId}`);

    if (!channelId) {
      console.error('❌ TELEGRAM_CHAT_ID 未配置，无法发送消息');
      return;
    }

    const message = `
🔵 *ETHEREUM 大额现货交易警报* 🔵
━━━━━━━━━━━━━━━━━━━━━
💰 金额: *${formatAmount(value)} ETH*
👤 从: [${shortenAddress(from)}](https://etherscan.io/address/${from})
👥 至: [${shortenAddress(to)}](https://etherscan.io/address/${to})
🔗 [查看交易](https://etherscan.io/tx/${hash})
⏰ 时间: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━
🤖 *鲸鱼监控机器人*
`;

    const success = await sendToChannel(channelId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    if (success) {
      console.log(`✅ 以太坊现货警报发送成功: ${value} ETH`);
    } else {
      console.error(`❌ 以太坊现货警报发送失败`);
    }
  }

  /**
   * 发送以太坊合约交易警报
   */
  private async sendEthereumContractAlert(tx: any, protocolName: string, eventName: string, estimatedValue: number): Promise<void> {
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
    console.log(`📱 准备发送以太坊合约警报到频道: ${channelId}`);

    if (!channelId) {
      console.error('❌ TELEGRAM_CHAT_ID 未配置，无法发送消息');
      return;
    }

    // 根据事件类型确定操作和图标
    let action = '合约操作';
    let actionIcon = '🔄';

    if (eventName.includes('Open') || eventName.includes('Increase')) {
      action = '开仓';
      actionIcon = '📈🟢';
    } else if (eventName.includes('Close') || eventName.includes('Decrease')) {
      action = '平仓';
      actionIcon = '📉🔴';
    } else if (eventName.includes('Trade')) {
      action = '交易';
      actionIcon = '💱';
    }

    const message = `
🔵 *ETHEREUM 大额合约交易警报* 🔵
━━━━━━━━━━━━━━━━━━━━━
${actionIcon} 操作: *${action}*
🏛️ 协议: ${protocolName}
💰 估算金额: *~$${formatAmount(estimatedValue)}*
👤 用户: [${shortenAddress(tx.from)}](https://etherscan.io/address/${tx.from})
🔗 [查看交易](https://etherscan.io/tx/${tx.hash})
⏰ 时间: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━
🤖 *鲸鱼监控机器人*
`;

    const success = await sendToChannel(channelId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    if (success) {
      console.log(`✅ 以太坊合约警报发送成功: ${protocolName} ${action} ~$${estimatedValue}`);
    } else {
      console.error(`❌ 以太坊合约警报发送失败`);
    }
  }

  /**
   * 发送Hyperliquid现货警报
   */
  private async sendHyperliquidAlert(trade: any, value: number): Promise<void> {
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
    console.log(`📱 准备发送Hyperliquid现货警报到频道: ${channelId}`);

    if (!channelId) {
      console.error('❌ TELEGRAM_CHAT_ID 未配置，无法发送消息');
      return;
    }

    const coin = trade.coin || trade.symbol || trade.asset || 'Unknown';
    const side = trade.side === 'A' ? '买入' : (trade.side === 'B' ? '卖出' : '未知');
    const size = trade.sz || trade.size || trade.amount || '0';
    const price = trade.px || trade.price || '0';

    const message = `
🟠 *HYPERLIQUID 大额现货交易警报* 🟠
━━━━━━━━━━━━━━━━━━━━━
💰 金额: *$${formatAmount(value)}*
📊 币种: ${coin} (${side})
📈 数量: ${formatAmount(size)}
💵 价格: $${formatAmount(price)}
⏰ 时间: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━
🤖 *鲸鱼监控机器人*
`;

    const success = await sendToChannel(channelId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    if (success) {
      console.log(`✅ Hyperliquid现货警报发送成功: $${value}`);
    } else {
      console.error(`❌ Hyperliquid现货警报发送失败`);
    }
  }

  /**
   * 发送Hyperliquid合约交易警报
   */
  private async sendHyperliquidContractAlert(trade: any, value: number): Promise<void> {
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
    console.log(`📱 准备发送Hyperliquid合约警报到频道: ${channelId}`);

    if (!channelId) {
      console.error('❌ TELEGRAM_CHAT_ID 未配置，无法发送消息');
      return;
    }

    const coin = trade.coin || 'Unknown';
    const action = trade.action || '未知操作';
    const size = trade.sz || '0';
    const price = trade.px || '0';
    const actionIcon = action.includes('开多') ? '📈🟢' : action.includes('开空') ? '📉🔴' :
                     action.includes('平多') ? '📈⚪' : action.includes('平空') ? '📉⚪' : '🔄';

    const message = `
🟠 *HYPERLIQUID 大额合约交易警报* 🟠
━━━━━━━━━━━━━━━━━━━━━
${actionIcon} 操作: *${action}*
💰 金额: *$${formatAmount(value)}*
📊 币种: ${coin}
📈 数量: ${formatAmount(size)}
💵 价格: $${formatAmount(price)}
⏰ 时间: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━
🤖 *鲸鱼监控机器人*
`;

    const success = await sendToChannel(channelId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    if (success) {
      console.log(`✅ Hyperliquid合约警报发送成功: ${action} $${value}`);
    } else {
      console.error(`❌ Hyperliquid合约警报发送失败`);
    }
  }

  /**
   * 发送Hyperliquid清算警报
   */
  private async sendHyperliquidLiquidationAlert(liquidation: any, value: number): Promise<void> {
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
    console.log(`📱 准备发送Hyperliquid清算警报到频道: ${channelId}`);

    if (!channelId) {
      console.error('❌ TELEGRAM_CHAT_ID 未配置，无法发送消息');
      return;
    }

    const coin = liquidation.coin || 'Unknown';
    const side = liquidation.side || '未知';
    const size = liquidation.sz || '0';
    const price = liquidation.px || '0';

    const message = `
🔴 *HYPERLIQUID 大额清算警报* 🔴
━━━━━━━━━━━━━━━━━━━━━
⚡ 清算: *${side.toUpperCase()}*
💰 金额: *$${formatAmount(value)}*
📊 币种: ${coin}
📈 数量: ${formatAmount(size)}
💵 价格: $${formatAmount(price)}
⏰ 时间: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━
🤖 *鲸鱼监控机器人*
`;

    const success = await sendToChannel(channelId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    if (success) {
      console.log(`✅ Hyperliquid清算警报发送成功: $${value}`);
    } else {
      console.error(`❌ Hyperliquid清算警报发送失败`);
    }
  }

  /**
   * 添加到缓存
   */
  private addToCache(id: string): void {
    this.transactionCache.add(id);
    
    if (this.transactionCache.size > this.CACHE_MAX_SIZE) {
      const iterator = this.transactionCache.values();
      for (let i = 0; i < 100; i++) {
        const next = iterator.next();
        if (!next.done && next.value) {
          this.transactionCache.delete(next.value);
        }
      }
    }
  }

  /**
   * 获取监听状态
   */
  public getStatus(): { active: boolean; connections: any } {
    return {
      active: this.isMonitoring,
      connections: {
        solana: this.solanaConnection ? 'connected' : 'disconnected',
        ethereum: this.ethereumProvider ? 'connected' : 'disconnected',
        hyperliquid: this.hyperliquidWs?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
        bitcoin: this.bitcoinCheckInterval ? 'connected' : 'disconnected'
      }
    };
  }

  /**
   * 启动比特币监听 (使用轮询，因为比特币没有WebSocket)
   */
  private async startBitcoinMonitoring(): Promise<void> {
    try {
      console.log('🔗 启动比特币监听...');

      // 比特币使用轮询方式，每30秒检查一次
      this.bitcoinCheckInterval = setInterval(async () => {
        await this.checkBitcoinTransactions();
      }, 30000);

      // 立即执行一次
      await this.checkBitcoinTransactions();

      console.log('✅ 比特币监听已启动');
    } catch (error) {
      console.error('比特币监听启动失败:', error);
    }
  }

  /**
   * 检查比特币交易
   */
  private async checkBitcoinTransactions(): Promise<void> {
    try {
      const axios = require('axios');

      // 获取最新区块
      const latestBlockResponse = await axios.get('https://blockstream.info/api/blocks/tip/height', {
        timeout: 10000
      });

      if (!latestBlockResponse.data) return;

      const latestHeight = latestBlockResponse.data;

      // 检查最近的区块
      for (let i = 0; i < 2; i++) {
        try {
          const blockHeight = latestHeight - i;
          const blockResponse = await axios.get(`https://blockstream.info/api/block-height/${blockHeight}`, {
            timeout: 10000
          });

          if (!blockResponse.data) continue;

          const blockHash = blockResponse.data;
          const blockTxsResponse = await axios.get(`https://blockstream.info/api/block/${blockHash}/txs`, {
            timeout: 10000
          });

          if (!blockTxsResponse.data || !Array.isArray(blockTxsResponse.data)) continue;

          for (const tx of blockTxsResponse.data) {
            try {
              // 计算交易总输出值
              let totalOutput = 0;
              if (tx.vout && Array.isArray(tx.vout)) {
                for (const output of tx.vout) {
                  if (output.value) {
                    totalOutput += output.value;
                  }
                }
              }

              // 转换为BTC (satoshi to BTC)
              const btcValue = totalOutput / 100000000;

              if (btcValue >= this.thresholds.bitcoin) {
                console.log(`🔍 检测到比特币大额交易: ${btcValue} BTC, 哈希: ${tx.txid}`);

                if (!this.transactionCache.has(tx.txid)) {
                  console.log(`📤 发送比特币警报: ${btcValue} BTC`);

                  // 获取输入和输出地址
                  let fromAddress = 'Unknown';
                  let toAddress = 'Unknown';

                  if (tx.vin && tx.vin.length > 0 && tx.vin[0].prevout && tx.vin[0].prevout.scriptpubkey_address) {
                    fromAddress = tx.vin[0].prevout.scriptpubkey_address;
                  }

                  if (tx.vout && tx.vout.length > 0 && tx.vout[0].scriptpubkey_address) {
                    toAddress = tx.vout[0].scriptpubkey_address;
                  }

                  await this.sendBitcoinAlert(tx.txid, btcValue, fromAddress, toAddress, blockHeight);
                  this.addToCache(tx.txid);
                } else {
                  console.log(`⚠️ 比特币交易已缓存，跳过: ${tx.txid}`);
                }
              }
            } catch (txError) {
              continue;
            }
          }
        } catch (blockError) {
          console.warn(`获取比特币区块失败:`, blockError);
          continue;
        }
      }
    } catch (error) {
      console.warn('检查比特币交易失败:', error);
    }
  }

  /**
   * 发送比特币警报
   */
  private async sendBitcoinAlert(hash: string, value: number, from: string, to: string, blockHeight: number): Promise<void> {
    const channelId = BOT_CONFIG.TELEGRAM_CHAT_ID;
    console.log(`📱 准备发送比特币警报到频道: ${channelId}`);

    if (!channelId) {
      console.error('❌ TELEGRAM_CHAT_ID 未配置，无法发送消息');
      return;
    }

    const message = `
🟡 *BITCOIN 大额交易警报* 🟡
━━━━━━━━━━━━━━━━━━━━━
💰 金额: *${formatAmount(value)} BTC*
👤 从: [${shortenAddress(from)}](https://blockstream.info/address/${from})
👥 至: [${shortenAddress(to)}](https://blockstream.info/address/${to})
🔗 [查看交易](https://blockstream.info/tx/${hash})
📦 区块: ${blockHeight}
⏰ 时间: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━
🤖 *鲸鱼监控机器人*
`;

    const success = await sendToChannel(channelId, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    if (success) {
      console.log(`✅ 比特币警报发送成功: ${value} BTC`);
    } else {
      console.error(`❌ 比特币警报发送失败`);
    }
  }

  /**
   * 更新监控阈值
   */
  public updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('监控阈值已更新:', this.thresholds);
  }
}

export default new WebSocketMonitor();

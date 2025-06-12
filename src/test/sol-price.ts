import axios from 'axios';

/**
 * 获取SOL/USDC价格
 * 使用多个API源获取价格，确保可靠性
 */
async function getSolPrice() {
  console.log('开始获取SOL/USDC价格...');
  
  // 方法1: 使用Jupiter API
  try {
    console.log('尝试Jupiter API...');
    const jupiterResponse = await axios.get('https://price.jup.ag/v4/price', {
      params: {
        ids: 'SOL',
        vsToken: 'USDC'
      }
    });
    
    if (jupiterResponse.data && 
        jupiterResponse.data.data && 
        jupiterResponse.data.data.SOL && 
        jupiterResponse.data.data.SOL.price) {
      const price = jupiterResponse.data.data.SOL.price;
      console.log(`[Jupiter] SOL/USDC 价格: ${price}`);
    }
  } catch (error: any) {
    console.error('Jupiter API 调用失败:', error.message);
  }
  
  // 方法2: 使用CoinGecko API
  try {
    console.log('尝试CoinGecko API...');
    const geckoResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'solana',
        vs_currencies: 'usd'
      }
    });
    
    if (geckoResponse.data && geckoResponse.data.solana && geckoResponse.data.solana.usd) {
      const price = geckoResponse.data.solana.usd;
      console.log(`[CoinGecko] SOL/USD 价格: ${price}`);
    }
  } catch (error: any) {
    console.error('CoinGecko API 调用失败:', error.message);
  }
  
  // 方法3: 使用Binance API
  try {
    console.log('尝试Binance API...');
    const binanceResponse = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: {
        symbol: 'SOLUSDT'
      }
    });
    
    if (binanceResponse.data && binanceResponse.data.price) {
      const price = binanceResponse.data.price;
      console.log(`[Binance] SOL/USDT 价格: ${price}`);
    }
  } catch (error: any) {
    console.error('Binance API 调用失败:', error.message);
  }
  
  // 方法4: 使用Raydium API
  try {
    console.log('尝试Raydium API...');
    const raydiumResponse = await axios.get('https://api.raydium.io/v2/main/pairs');
    
    // 查找SOL/USDC交易对
    const solUsdcPair = raydiumResponse.data.find((p: any) => 
      p.name === 'WSOL/USDC' || p.name === 'USDC/WSOL'
    );
    
    if (solUsdcPair) {
      let price = parseFloat(solUsdcPair.price);
      if (solUsdcPair.name === 'USDC/WSOL') {
        price = 1 / price; // 反转价格
      }
      console.log(`[Raydium] SOL/USDC 价格: ${price}`);
    } else {
      console.log('[Raydium] 未找到SOL/USDC交易对');
    }
  } catch (error: any) {
    console.error('Raydium API 调用失败:', error.message);
  }
  
  console.log('价格获取完成');
}

// 执行测试
getSolPrice(); 
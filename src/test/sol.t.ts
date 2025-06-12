import axios from 'axios';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';

// WIF 和 USDC 的 Mint 地址
const WIF_MINT = '7JhcfaDQevn4MV3XtRewL1xsxkBu47yrQsqo9vRBrPRX';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function getWifPriceInUSDC(amount = 1) {
  try {
    // Jupiter 需要的 amount 是最小单位（WIF 是 6 位精度）
    const inputAmount = amount * 10 ** 6;

    const response = await axios.get(JUPITER_QUOTE_API, {
      params: {
        inputMint: WIF_MINT,
        outputMint: USDC_MINT,
        amount: inputAmount,
        slippageBps: 50,  // 允许的滑点，50 = 0.5%
        onlyDirectRoutes: true,
      }
    });

    const data = response.data;
    if (data && data.data && data.data.length > 0) {
      const bestRoute = data.data[0];
      const outAmount = Number(bestRoute.outAmount) / 10 ** 6;
      console.log(`[Jupiter] ${amount} WIF ≈ ${outAmount} USDC`);
      return outAmount;
    } else {
      console.warn('[Jupiter] 未找到有效报价');
      return null;
    }

  } catch (error) {
    console.error('[Jupiter] 查询失败:', error);
    return null;
  }
}

// 示例：查询 1 WIF 的价格
getWifPriceInUSDC();

// Jest测试设置文件

// 设置全局测试超时
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // 在测试开始前设置mock
  if (process.env.JEST_SILENT !== 'false') {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.info = jest.fn();
  }
});

afterAll(() => {
  // 恢复原始console
  if (process.env.JEST_SILENT !== 'false') {
    Object.assign(console, originalConsole);
  }
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 设置测试环境
(global as any).testEnvironment = {
  isTest: true,
  skipNetworkTests: process.env.SKIP_NETWORK_TESTS === 'true'
};

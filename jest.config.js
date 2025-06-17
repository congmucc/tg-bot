module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**/*',
    '!src/index.ts' // 排除主入口文件
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 30000, // 30秒默认超时
  verbose: true,
  // 忽略一些可能导致测试不稳定的模块
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/'
  ],
  // 环境变量设置
  setupFiles: ['<rootDir>/src/tests/env.setup.ts']
};

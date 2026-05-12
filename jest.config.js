module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/setup.js'],
  verbose: true,
  // Increase timeout for API calls
  testTimeout: 15000
};

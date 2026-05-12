// Run before all tests — set the environment so auth middleware is bypassed
// and database uses a test-specific file
process.env.NODE_ENV = 'test';
process.env.DEMO_USER = 'testuser';
process.env.DEMO_PASSWORD = 'testpassword';
process.env.SESSION_SECRET = 'test-secret';
// Use an in-memory-style temp DB for tests
process.env.DB_PATH = ':memory:';
// Disable demo chat limit in tests (0 = unlimited)
process.env.CHAT_LIMIT = '0';

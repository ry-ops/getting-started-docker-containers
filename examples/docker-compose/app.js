const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
});

// Redis connection
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
  }
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().catch(console.error);

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Home endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Full-stack Docker Compose application',
    services: {
      app: 'Node.js/Express',
      database: 'PostgreSQL',
      cache: 'Redis'
    },
    timestamp: new Date().toISOString()
  });
});

// Database endpoint - get users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, created_at FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows, count: result.rowCount });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Database endpoint - create user
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
      [name, email]
    );

    // Invalidate cache
    await redisClient.del('users:count');

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Redis cache endpoint - get cached count
app.get('/api/stats', async (req, res) => {
  try {
    // Try to get from cache
    let userCount = await redisClient.get('users:count');

    if (userCount === null) {
      // Not in cache, query database
      const result = await pool.query('SELECT COUNT(*) FROM users');
      userCount = result.rows[0].count;

      // Store in cache for 60 seconds
      await redisClient.setEx('users:count', 60, userCount.toString());
    }

    res.json({
      totalUsers: parseInt(userCount),
      cached: userCount !== null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Redis cache endpoint - test cache
app.get('/api/cache/test', async (req, res) => {
  try {
    const key = 'test:timestamp';
    const value = new Date().toISOString();

    await redisClient.setEx(key, 30, value);
    const retrieved = await redisClient.get(key);

    res.json({
      message: 'Redis cache working',
      stored: value,
      retrieved: retrieved,
      match: value === retrieved
    });
  } catch (err) {
    console.error('Redis error:', err);
    res.status(500).json({ error: 'Cache operation failed' });
  }
});

// Database connection test
app.get('/api/db/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      message: 'Database connection working',
      timestamp: result.rows[0].current_time
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Full-stack app running on port ${port}`);
  console.log(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

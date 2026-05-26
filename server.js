require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { getPool, closePool } = require('./config/db/pool');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(routes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'UniQueue' });
});

async function start() {
  try {
    await getPool();
    console.log('MSSQL connection pool ready');
  } catch (err) {
    console.warn('Database not connected — API will fail until MSSQL is available:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`UniQueue running at http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

start();

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'turntable.proxy.rlwy.net',
  user: 'root',
  password: 'mLokaSWyKTCcaXNLLxrWtmxXruYPaIDu',
  database: 'railway',
  port: 33304,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;

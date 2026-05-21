const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Teste de conexão ao iniciar
pool.query('SELECT NOW()')
    .then(() => console.log('Conectado ao PostgreSQL'))
    .catch(err => console.error('Erro na conexão:', err));

module.exports = pool;
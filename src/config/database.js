const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// Teste de conexão ao iniciar, com algumas retentativas para cobrir o
// tempo de init/restore do Postgres no primeiro boot do container.
async function aguardarConexao(tentativas = 5, intervaloMs = 3000) {
    for (let i = 1; i <= tentativas; i++) {
        try {
            await pool.query('SELECT NOW()');
            console.log('Conectado ao PostgreSQL');
            return;
        } catch (err) {
            console.warn(`Tentativa ${i}/${tentativas} falhou (${err.code}). Retentando em ${intervaloMs}ms...`);
            await new Promise(r => setTimeout(r, intervaloMs));
        }
    }
    console.error('Não foi possível conectar ao PostgreSQL após várias tentativas.');
}

aguardarConexao();

module.exports = pool;
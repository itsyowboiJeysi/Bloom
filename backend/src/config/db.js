const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'bloom_db';

const pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true
});

async function ensureDatabaseExists() {
    try {
        const rootConn = await mysql.createConnection({
            host: dbHost,
            port: dbPort,
            user: dbUser,
            password: dbPassword,
            multipleStatements: true
        });

        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        await rootConn.end();

        // Initialize schema tables if schema.sql exists
        const schemaPath = path.join(__dirname, '../../../database/schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            const conn = await pool.getConnection();
            await conn.query(schemaSql);
            conn.release();
        }
        return true;
    } catch (err) {
        return false;
    }
}

async function testDbConnection() {
    try {
        await ensureDatabaseExists();
        const connection = await pool.getConnection();
        console.log(`✅ MySQL Database '${dbName}' connected & initialized successfully!`);
        connection.release();
        return true;
    } catch (err) {
        console.warn('⚠️  MySQL Database connection failed (verify DB server & .env settings):', err.message);
        return false;
    }
}

module.exports = {
    pool,
    testDbConnection
};

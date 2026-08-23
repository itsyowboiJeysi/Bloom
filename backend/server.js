const dotenv = require('dotenv');
const app = require('./src/app');
const { testDbConnection } = require('./src/config/db');

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`🚀 Bloom Server running on port ${PORT}`);
    await testDbConnection();
});

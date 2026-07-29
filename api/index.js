const app = require('../server.js');
const { connectDB, initializeDatabase } = require('../database.js');

module.exports = async (req, res) => {
    try {
        // Ensure the database connection is resolved before handing off to Express
        await connectDB();
        await initializeDatabase();
    } catch (err) {
        // If DB fails to connect (e.g. invalid URI or password), return a JSON error Instead of crashing
        return res.status(500).json({ error: 'Database connection failed: ' + err.message });
    }
    
    // Hand the request to Express
    return app(req, res);
};

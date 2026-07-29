const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, initializeDatabase, User, Product, Invoice, Category } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB when running locally
if (process.env.NODE_ENV !== 'production') {
    connectDB().then(() => {
        initializeDatabase();
    });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==== AUTH API ====

app.post('/api/auth/register', async (req, res) => {
    const { email, password, business_name, whatsapp_number } = req.body;
    if (!email || !password || !business_name || !whatsapp_number) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const existingUser = await User.findOne({ email: new RegExp('^' + String(email) + '$', 'i') });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const user = await User.create({ email: String(email), password: String(password), business_name: String(business_name), whatsapp_number: String(whatsapp_number), status: 'pending' });
        res.status(201).json({ 
            message: 'Registration submitted successfully. Please wait for an Admin to approve your request.',
            pending: true
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const user = await User.findOne({ 
            email: new RegExp('^' + String(email) + '$', 'i'),
            password: String(password)
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (user.status !== 'approved') {
            return res.status(403).json({ error: 'Account pending admin approval or blocked.' });
        }
        res.json({ 
            token: user._id.toString(), 
            business_name: user.business_name, 
            role: user.role,
            email: user.email,
            whatsapp_number: user.whatsapp_number,
            bank_details: user.bank_details
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== AUTH MIDDLEWARE ====
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const user = await User.findById(token);
        if (!user || user.status !== 'approved') return res.status(401).json({ error: 'Unauthorized' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

app.use('/api', (req, res, next) => {
    if (req.path === '/auth/login' || req.path === '/auth/register' || req.path.startsWith('/public')) return next();
    return authMiddleware(req, res, next);
});

app.get('/api/auth/me', async (req, res) => {
    res.json({
        business_name: req.user.business_name,
        email: req.user.email,
        whatsapp_number: req.user.whatsapp_number,
        bank_details: req.user.bank_details,
        role: req.user.role
    });
});

// ==== ADMIN API ====

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admins only' });
    }
};

// ==== PROFILE API ====
app.get('/api/profile', async (req, res) => {
    try {
        res.json({
            email: req.user.email,
            business_name: req.user.business_name,
            whatsapp_number: req.user.whatsapp_number,
            profile_picture: req.user.profile_picture,
            bank_details: req.user.bank_details
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/profile', async (req, res) => {
    const { email, business_name, whatsapp_number, profile_picture, bank_details, password } = req.body;
    try {
        const updateData = { email, business_name, whatsapp_number, profile_picture, bank_details };
        if (password && password.trim() !== '') {
            updateData.password = password;
        }

        await User.findByIdAndUpdate(req.user._id, updateData);
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/users', adminMiddleware, async (req, res) => {
    try {
        const users = await User.find({ role: { $ne: 'admin' } }).select('-password');
        const mappedUsers = users.map(u => ({
            id: u._id.toString(),
            email: u.email,
            business_name: u.business_name,
            whatsapp_number: u.whatsapp_number,
            marketplace_enabled: u.marketplace_enabled,
            role: u.role,
            status: u.status,
            profile_picture: u.profile_picture
        }));
        res.json(mappedUsers);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users', adminMiddleware, async (req, res) => {
    const { email, password, business_name, whatsapp_number, marketplace_enabled, status } = req.body;
    if (!email || !password || !business_name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const existingUser = await User.findOne({ email: new RegExp('^' + String(email) + '$', 'i') });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });
        
        const user = await User.create({ 
            email: String(email), 
            password: String(password),
            business_name: String(business_name), 
            whatsapp_number: String(whatsapp_number || ''), 
            marketplace_enabled: Boolean(marketplace_enabled),
            status: status || 'approved'
        });
        res.status(201).json({ message: 'User created successfully', id: user._id.toString() });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id', adminMiddleware, async (req, res) => {
    const { email, business_name, whatsapp_number, marketplace_enabled, status, password } = req.body;
    try {
        const updateData = { email, business_name, whatsapp_number, marketplace_enabled, status };
        if (password && password.trim() !== '') {
            updateData.password = password;
        }
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', adminMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByIdAndDelete(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Also delete associated products and invoices
        await Product.deleteMany({ user_id: userId });
        await Invoice.deleteMany({ user_id: userId });
        
        res.json({ message: 'User and all associated data deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== DASHBOARD API ====

app.get('/api/dashboard', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7); // YYYY-MM
    
    // Admin query filter bypass
    const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
    
    try {
        // Daily Stats
        const dailyInvoices = await Invoice.find({ ...queryFilter, date: today });
        const totalBillsToday = dailyInvoices.length;
        // Deduct 500 from each order to split into delivery; 500 stays in delivery price
        const dailyIncome = dailyInvoices.reduce((sum, inv) => sum + (inv.total_amount - 500), 0);
        const dailyDelivery = totalBillsToday * 500;

        // Monthly Stats
        const monthlyInvoices = await Invoice.find({ ...queryFilter, date: new RegExp('^' + currentMonth) });
        const totalBillsMonth = monthlyInvoices.length;
        const monthlyIncome = monthlyInvoices.reduce((sum, inv) => sum + (inv.total_amount - 500), 0);
        const monthlyDelivery = totalBillsMonth * 500;

        // Product Stats
        const totalProducts = await Product.countDocuments(queryFilter);
        const lowStockProducts = await Product.countDocuments({ ...queryFilter, quantity: { $lte: 10 } });

        res.json({
            totalBillsToday,
            dailyIncome,
            dailyDelivery,
            totalBillsMonth,
            monthlyIncome,
            monthlyDelivery,
            totalProducts,
            lowStockProducts
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard/low-stock', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const products = await Product.find({ ...queryFilter, quantity: { $lte: 10 } })
            .populate('user_id', 'business_name')
            .sort({ quantity: 1 })
            .limit(10);
            
        const mappedProducts = products.map(p => ({
            id: p._id.toString(),
            name: p.name,
            quantity: p.quantity,
            price: p.price,
            owner_name: p.user_id ? p.user_id.business_name : 'Unknown'
        }));
        
        res.json(mappedProducts);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== CATEGORY API ====
app.get('/api/categories', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const categories = await Category.find(queryFilter).sort({ name: 1 });
        res.json(categories.map(c => ({ id: c._id.toString(), name: c.name })));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
        const category = await Category.create({ user_id: req.user._id, name });
        res.status(201).json({ id: category._id.toString(), name: category.name });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const category = await Category.findOneAndDelete(queryFilter);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== INVENTORY (PRODUCTS) API ====

app.get('/api/products', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const products = await Product.find(queryFilter)
            .populate('user_id', 'business_name')
            .sort({ name: 1 });
        
        // Map _id to id for the frontend
        const mappedProducts = products.map(p => ({
            id: p._id.toString(),
            category: p.category,
            name: p.name,
            quantity: p.quantity,
            price: p.price,
            image: p.image,
            owner_name: p.user_id ? p.user_id.business_name : 'Unknown'
        }));
        
        res.json(mappedProducts);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    const { name, category, quantity, price, image } = req.body;
    if (!name || quantity === undefined || price === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const product = await Product.create({
            user_id: req.user._id,
            category: category || 'General',
            name,
            quantity,
            price,
            image
        });
        res.status(201).json({ id: product._id.toString(), category: product.category, name, quantity, price, image });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    const { name, category, quantity, price, image } = req.body;
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const product = await Product.findOneAndUpdate(
            queryFilter,
            { name, category, quantity, price, image },
            { new: true }
        );
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const product = await Product.findOneAndDelete(queryFilter);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== INVOICES API ====

app.get('/api/invoices', async (req, res) => {
    const { date, month } = req.query;
    let query = req.user.role === 'admin' ? {} : { user_id: req.user._id };

    if (date) {
        query.date = date;
    } else if (month) {
        query.date = new RegExp('^' + month);
    }

    try {
        const invoices = await Invoice.find(query)
            .populate('user_id', 'business_name')
            .sort({ date: -1, time: -1 });
        
        // Map _id to id for frontend
        const mappedInvoices = invoices.map(inv => ({
            id: inv._id.toString(),
            invoice_number: inv.invoice_number,
            date: inv.date,
            time: inv.time,
            customer_name: inv.customer_name,
            customer_number: inv.customer_number,
            business_details: inv.business_details,
            sub_total: inv.sub_total,
            discount: inv.discount,
            delivery_fee: inv.delivery_fee,
            total_amount: inv.total_amount,
            advance_payment: inv.advance_payment,
            balance: inv.balance,
            owner_name: inv.user_id ? inv.user_id.business_name : 'Unknown'
        }));
        
        res.json(mappedInvoices);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/invoices/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const invoice = await Invoice.findOne(queryFilter).populate('user_id', 'business_name');
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        
        const response = {
            id: invoice._id.toString(),
            invoice_number: invoice.invoice_number,
            date: invoice.date,
            time: invoice.time,
            customer_name: invoice.customer_name,
            customer_number: invoice.customer_number,
            business_details: invoice.business_details,
            sub_total: invoice.sub_total,
            discount: invoice.discount,
            delivery_fee: invoice.delivery_fee,
            total_amount: invoice.total_amount,
            advance_payment: invoice.advance_payment,
            balance: invoice.balance,
            items: invoice.items.map(item => ({
                id: item._id ? item._id.toString() : null,
                product_name: item.product_name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal
            }))
        };
        res.json(response);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/invoices', async (req, res) => {
    const { items, sub_total, discount, delivery_fee, total_amount, advance_payment, balance, customer_name, customer_number } = req.body;
    
    if (!items || items.length === 0 || total_amount === undefined) {
        return res.status(400).json({ error: 'Invalid invoice data' });
    }

    const today = new Date();
    const date = today.toISOString().split('T')[0];
    const time = today.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    const invoice_number = 'INV-' + today.getTime().toString().slice(-6);

    const user = await User.findById(req.user._id);

    const formattedItems = items.map(item => ({
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.quantity * item.price
    }));

    // We can use a MongoDB transaction if it's a replica set, 
    // but typically Atlas free tier supports them. 
    // Standard Mongoose write:
    try {
        const invoice = await Invoice.create({
            user_id: req.user._id,
            invoice_number,
            date,
            time,
            customer_name: customer_name || '',
            customer_number: customer_number || '',
            business_details: {
                name: user ? user.business_name : '',
                email: user ? user.email : '',
                whatsapp: user ? user.whatsapp_number : '',
                bank_details: user ? user.bank_details : ''
            },
            sub_total: sub_total || 0,
            discount: discount || 0,
            delivery_fee: delivery_fee || 0,
            total_amount,
            advance_payment: advance_payment || 0,
            balance: balance || 0,
            items: formattedItems
        });
        
        // Update product stock manually in series or parallel
        for (const item of items) {
            if (item.id) {
                await Product.findOneAndUpdate(
                    { _id: item.id, user_id: req.user._id },
                    { $inc: { quantity: -item.quantity } }
                );
            } else {
                await Product.findOneAndUpdate(
                    { name: item.name, user_id: req.user._id },
                    { $inc: { quantity: -item.quantity } }
                );
            }
        }

        res.status(201).json({ 
            message: 'Invoice created successfully',
            invoice: {
                id: invoice._id.toString(),
                invoice_number,
                date,
                time,
                sub_total: invoice.sub_total,
                discount: invoice.discount,
                delivery_fee: invoice.delivery_fee,
                total_amount: invoice.total_amount,
                advance_payment: invoice.advance_payment,
                balance: invoice.balance,
                customer_name: invoice.customer_name,
                customer_number: invoice.customer_number,
                business_details: invoice.business_details,
                items: formattedItems
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/invoices/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const invoice = await Invoice.findOneAndDelete(queryFilter);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        
        // Need to add back the stock quantities
        if (invoice.user_id) {
            for (const item of invoice.items) {
                await Product.findOneAndUpdate(
                    { name: item.product_name, user_id: invoice.user_id },
                    { $inc: { quantity: item.quantity } }
                );
            }
        }
        res.json({ message: 'Invoice deleted successfully. Inventory restocked.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== REPORTS API ====

app.get('/api/reports/sales', async (req, res) => {
    try {
        const queryMatch = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const result = await Invoice.aggregate([
            { $match: queryMatch },
            { $group: { _id: "$date", total_sales: { $sum: "$total_amount" } } },
            { $project: { date: "$_id", total_sales: 1, _id: 0 } },
            { $sort: { date: -1 } }
        ]);
        res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/product-sales', async (req, res) => {
    try {
        const queryMatch = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const result = await Invoice.aggregate([
            { $match: queryMatch },
            { $unwind: "$items" },
            { $group: { 
                _id: "$items.product_name", 
                quantity_sold: { $sum: "$items.quantity" },
                revenue: { $sum: "$items.subtotal" }
            }},
            { $project: { product_name: "$_id", quantity_sold: 1, revenue: 1, _id: 0 } },
            { $sort: { quantity_sold: -1 } }
        ]);
        res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== MARKETPLACE API ====

app.post('/api/marketplace/enable', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { marketplace_enabled: true });
        res.json({ message: 'Marketplace enabled successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/public/store/:business_name', async (req, res) => {
    try {
        const storeOwner = await User.findOne({ business_name: req.params.business_name });
        if (!storeOwner || storeOwner.marketplace_enabled !== true) {
            return res.status(404).json({ error: 'Store not found or marketplace is disabled' });
        }
        
        // Return products that have stock
        const products = await Product.find({ user_id: storeOwner._id, quantity: { $gt: 0 } }).sort({ name: 1 });
        const mappedProducts = products.map(p => ({
            id: p._id.toString(),
            name: p.name,
            price: p.price,
            image: p.image
        }));
        
        // Return store info and products
        res.json({
            business_name: storeOwner.business_name,
            whatsapp_number: storeOwner.whatsapp_number,
            products: mappedProducts
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Serves the public marketplace UI
app.get('/:business_name', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'marketplace.html'));
});

// Global Error Handler for Express to prevent HTML errors
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'A server error occurred: ' + err.message });
});

// Export app for Vercel, listen for local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
module.exports = app;

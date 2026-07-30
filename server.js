const express = require('express');
const cors = require('cors');
const path = require('path');
const { 
    connectDB, initializeDatabase, User, Product, Invoice, Category, Material, 
    Announcement, Message, Review, ActivityLog, MediaItem, SeoSettings, Subject, Grade, 
    AdSettings, SiteSettings 
} = require('./database');

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
    // /api/admin/* routes handle their own admin-role authentication internally
    if (req.path.startsWith('/admin')) return next();
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

// ==== EDUCATIONAL MATERIALS API (Dashboard) ====

app.get('/api/materials', async (req, res) => {
    try {
        let query = { user_id: req.user._id };
        if (req.user.role === 'admin') {
            query = {}; // Admin can view all materials
        }
        const materials = await Material.find(query).sort({ created_at: -1 }).populate('user_id', 'business_name email');
        const mapped = materials.map(m => ({
            id: m._id.toString(),
            title: m.title,
            grade: m.grade,
            subject: m.subject,
            material_type: m.material_type,
            description: m.description,
            file_data: m.file_data,
            file_name: m.file_name,
            download_count: m.download_count,
            created_at: m.created_at,
            publisher_name: m.user_id ? m.user_id.business_name : 'Unknown'
        }));
        res.json(mapped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/materials', async (req, res) => {
    const { title, grade, subject, material_type, description, file_data, file_name } = req.body;
    if (!title || !grade || !subject || !material_type) {
        return res.status(400).json({ error: 'Title, grade (1-13), subject, and material type are required' });
    }
    const gradeNum = parseInt(grade, 10);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 13) {
        return res.status(400).json({ error: 'Grade must be a number between 1 and 13' });
    }
    try {
        const material = await Material.create({
            user_id: req.user._id,
            title: String(title),
            grade: gradeNum,
            subject: String(subject),
            material_type: String(material_type),
            description: String(description || ''),
            file_data: String(file_data || ''),
            file_name: String(file_name || '')
        });
        res.status(201).json({ message: 'Material added successfully', id: material._id.toString() });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/materials/:id', async (req, res) => {
    const { title, grade, subject, material_type, description, file_data, file_name } = req.body;
    try {
        const material = await Material.findById(req.params.id);
        if (!material) return res.status(404).json({ error: 'Material not found' });
        if (req.user.role !== 'admin' && material.user_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized to edit this material' });
        }
        
        if (title) material.title = String(title);
        if (grade) material.grade = parseInt(grade, 10);
        if (subject) material.subject = String(subject);
        if (material_type) material.material_type = String(material_type);
        if (description !== undefined) material.description = String(description);
        if (file_data !== undefined) material.file_data = String(file_data);
        if (file_name !== undefined) material.file_name = String(file_name);

        await material.save();
        res.json({ message: 'Material updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/materials/:id', async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);
        if (!material) return res.status(404).json({ error: 'Material not found' });
        if (req.user.role !== 'admin' && material.user_id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized to delete this material' });
        }
        await Material.findByIdAndDelete(req.params.id);
        res.json({ message: 'Material deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== PUBLIC STUDENT MATERIALS API ====

// Public site settings (no auth needed — read-only for marketplace)
app.get('/api/public/site-settings', async (req, res) => {
    try {
        let settings = await SiteSettings.findById('global');
        if (!settings) settings = { siteName: 'EduPortal Sri Lanka', contactWhatsApp: '' };
        res.json({ siteName: settings.siteName, contactWhatsApp: settings.contactWhatsApp });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/public/materials', async (req, res) => {
    try {
        const { grade, material_type, subject, search, business_name } = req.query;
        let query = {};
        
        if (grade && grade !== 'all') {
            const gradeNum = parseInt(grade, 10);
            if (!isNaN(gradeNum)) query.grade = gradeNum;
        }
        if (material_type && material_type !== 'all') {
            query.material_type = material_type;
        }
        if (subject && subject.trim() !== '') {
            query.subject = new RegExp(subject.trim(), 'i');
        }
        if (search && search.trim() !== '') {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [{ title: regex }, { description: regex }, { subject: regex }];
        }
        
        if (business_name) {
            const storeOwner = await User.findOne({ business_name: decodeURIComponent(business_name) });
            if (storeOwner) {
                query.user_id = storeOwner._id;
            }
        }

        const materials = await Material.find(query).sort({ created_at: -1 }).populate('user_id', 'business_name');
        const mapped = materials.map(m => {
            const fd = m.file_data || '';
            const isDriveUrl = fd.startsWith('http://') || fd.startsWith('https://');
            return {
                id: m._id.toString(),
                title: m.title,
                grade: m.grade,
                subject: m.subject,
                material_type: m.material_type,
                description: m.description,
                has_file: !!fd,
                is_drive_url: isDriveUrl,
                drive_url: isDriveUrl ? fd : null,
                file_name: m.file_name,
                download_count: m.download_count,
                created_at: m.created_at,
                publisher_name: m.user_id ? m.user_id.business_name : 'EduPortal Academy'
            };
        });
        res.json(mapped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/public/materials/download/:id', async (req, res) => {
    try {
        const material = await Material.findByIdAndUpdate(
            req.params.id,
            { $inc: { download_count: 1 } },
            { new: true }
        );
        if (!material) return res.status(404).json({ error: 'Material not found' });
        const fd = material.file_data || '';
        const isDriveUrl = fd.startsWith('http://') || fd.startsWith('https://');
        res.json({
            id: material._id.toString(),
            title: material.title,
            grade: material.grade,
            subject: material.subject,
            material_type: material.material_type,
            description: material.description,
            // Only send base64 data for embedded files; for URLs send the URL separately
            file_data: isDriveUrl ? null : (fd || null),
            is_drive_url: isDriveUrl,
            drive_url: isDriveUrl ? fd : null,
            file_name: material.file_name,
            download_count: material.download_count
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Record public view count
app.post('/api/public/materials/view/:id', async (req, res) => {
    try {
        const material = await Material.findByIdAndUpdate(
            req.params.id,
            { $inc: { view_count: 1 } },
            { new: true }
        );
        res.json({ success: true, view_count: material ? material.view_count : 0 });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== ANNOUNCEMENTS API ====
app.get('/api/announcements', async (req, res) => {
    try {
        const list = await Announcement.find({}).sort({ created_at: -1 });
        res.json(list);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/announcements', async (req, res) => {
    try {
        const { title, content, target_grade } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
        const item = await Announcement.create({ title, content, target_grade: target_grade || 'all' });
        
        // Log action
        await ActivityLog.create({
            user_id: req.user ? req.user._id.toString() : 'Admin',
            user_email: req.user ? req.user.email : 'admin@eduportal.lk',
            action: 'Created Announcement',
            details: `Title: ${title}`
        });

        res.status(201).json(item);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/announcements/:id', async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ message: 'Announcement deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== MESSAGES & CONTACT API ====
app.get('/api/messages', async (req, res) => {
    try {
        const list = await Message.find({}).sort({ created_at: -1 });
        res.json(list);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/public/messages', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        if (!name || !email || !message) return res.status(400).json({ error: 'Name, email, and message are required.' });
        const item = await Message.create({ name, email, subject, message });
        res.status(201).json({ message: 'Message sent successfully!', id: item._id });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/messages/:id/read', async (req, res) => {
    try {
        const item = await Message.findByIdAndUpdate(req.params.id, { status: 'read' }, { new: true });
        res.json(item);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/messages/:id', async (req, res) => {
    try {
        await Message.findByIdAndDelete(req.params.id);
        res.json({ message: 'Message deleted' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== REVIEWS API ====
app.get('/api/reviews', async (req, res) => {
    try {
        const list = await Review.find({}).sort({ created_at: -1 });
        res.json(list);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/public/reviews', async (req, res) => {
    try {
        const { material_id, material_title, user_name, rating, comment } = req.body;
        if (!user_name || !rating || !comment) return res.status(400).json({ error: 'Name, rating, and comment are required.' });
        const item = await Review.create({ material_id, material_title, user_name, rating, comment });
        res.status(201).json({ message: 'Review submitted successfully!', id: item._id });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/reviews/:id', async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        res.json({ message: 'Review deleted' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== SEO SETTINGS API ====
app.get('/api/seo', async (req, res) => {
    try {
        let seo = await SeoSettings.findOne({ _id: 'global' });
        if (!seo) seo = { metaTitle: 'EduPortal Sri Lanka', metaDescription: '', metaKeywords: '', ogImage: '', robots: 'index, follow' };
        res.json(seo);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/seo', async (req, res) => {
    try {
        const { metaTitle, metaDescription, metaKeywords, ogImage, robots } = req.body;
        const seo = await SeoSettings.findOneAndUpdate(
            { _id: 'global' },
            { metaTitle, metaDescription, metaKeywords, ogImage, robots, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ message: 'SEO settings updated successfully', seo });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== MEDIA MANAGER API ====
app.get('/api/media', async (req, res) => {
    try {
        const list = await MediaItem.find({}).sort({ created_at: -1 });
        res.json(list);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/media', async (req, res) => {
    try {
        const { name, url, file_type, file_size } = req.body;
        if (!name || !url) return res.status(400).json({ error: 'Name and URL are required.' });
        const item = await MediaItem.create({ name, url, file_type: file_type || 'image', file_size: file_size || '0 KB' });
        res.status(201).json(item);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/media/:id', async (req, res) => {
    try {
        await MediaItem.findByIdAndDelete(req.params.id);
        res.json({ message: 'Media item deleted' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== BACKUP & RESTORE API ====
app.get('/api/backup/export', async (req, res) => {
    try {
        const materials = await Material.find({});
        const users = await User.find({}).select('-password');
        const announcements = await Announcement.find({});
        const adSettings = await AdSettings.findById('global');
        const siteSettings = await SiteSettings.findById('global');
        const seoSettings = await SeoSettings.findById('global');

        const backupData = {
            version: '2.0',
            exported_at: new Date().toISOString(),
            materials,
            users,
            announcements,
            adSettings,
            siteSettings,
            seoSettings
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=eduportal-backup-${Date.now()}.json`);
        res.send(JSON.stringify(backupData, null, 2));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/backup/import', async (req, res) => {
    try {
        const { materials } = req.body;
        if (!Array.isArray(materials)) return res.status(400).json({ error: 'Invalid backup format. Expected array of materials.' });
        
        let importedCount = 0;
        for (const item of materials) {
            if (item.title && item.grade && item.subject) {
                await Material.create({
                    user_id: req.user ? req.user._id : null,
                    title: item.title,
                    grade: item.grade,
                    subject: item.subject,
                    material_type: item.material_type || 'Paper (PDF)',
                    description: item.description || '',
                    file_data: item.file_data || '',
                    file_name: item.file_name || item.title
                });
                importedCount++;
            }
        }
        res.json({ message: `Successfully restored ${importedCount} materials!` });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== ACTIVITY LOGS API ====
app.get('/api/activity-logs', async (req, res) => {
    try {
        const logs = await ActivityLog.find({}).sort({ created_at: -1 }).limit(100);
        res.json(logs);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== ADMIN DASHBOARD STATS API ====
app.get('/api/admin/dashboard-stats', adminMiddleware, async (req, res) => {
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
        const newUsersToday = await User.countDocuments({ role: { $ne: 'admin' }, createdAt: { $gte: new Date(todayStr) } });
        const totalMaterials = await Material.countDocuments({});
        const totalPdfs = await Material.countDocuments({ material_type: 'Paper (PDF)' });
        const totalAnnouncements = await Announcement.countDocuments({});
        const totalMessages = await Message.countDocuments({});
        const pendingMessages = await Message.countDocuments({ status: 'unread' });
        const publishedMaterials = await Material.countDocuments({ status: 'published' });
        const pendingMaterials = await Material.countDocuments({ status: 'pending' });
        const draftMaterials = await Material.countDocuments({ status: 'draft' });
        const hiddenMaterials = await Material.countDocuments({ status: 'hidden' });
        const downloadsAgg = await Material.aggregate([{ $group: { _id: null, total: { $sum: '$download_count' } } }]);
        const totalDownloads = downloadsAgg.length > 0 ? downloadsAgg[0].total : 0;
        res.json({
            totalUsers, newUsersToday, totalMaterials, totalPdfs,
            totalAnnouncements, totalMessages, pendingMessages,
            publishedMaterials, pendingMaterials, draftMaterials, hiddenMaterials,
            totalDownloads
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== TAXONOMY API (SUBJECTS & GRADES) ====
app.get('/api/taxonomy/subjects', async (req, res) => {
    try {
        const subjects = await Subject.find({}).sort({ name: 1 });
        res.json(subjects);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/taxonomy/subjects', async (req, res) => {
    try {
        const { name, code, category } = req.body;
        if (!name) return res.status(400).json({ error: 'Subject name is required.' });
        const item = await Subject.create({ name, code: code || '', category: category || 'General' });
        res.status(201).json(item);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/taxonomy/subjects/:id', async (req, res) => {
    try {
        await Subject.findByIdAndDelete(req.params.id);
        res.json({ message: 'Subject deleted' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== ANALYTICS OVERVIEW API ====
app.get('/api/analytics/overview', async (req, res) => {
    try {
        const totalMaterials = await Material.countDocuments({});
        const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
        const totalAnnouncements = await Announcement.countDocuments({});
        const totalMessages = await Message.countDocuments({});
        const totalReviews = await Review.countDocuments({});

        const downloadsAgg = await Material.aggregate([{ $group: { _id: null, total: { $sum: '$download_count' } } }]);
        const totalDownloads = downloadsAgg.length > 0 ? downloadsAgg[0].total : 0;

        const viewsAgg = await Material.aggregate([{ $group: { _id: null, total: { $sum: '$view_count' } } }]);
        const totalViews = viewsAgg.length > 0 ? viewsAgg[0].total : 0;

        // Breakdown by Grade
        const gradeBreakdown = await Material.aggregate([
            { $group: { _id: '$grade', count: { $sum: 1 }, totalDownloads: { $sum: '$download_count' } } },
            { $sort: { _id: 1 } }
        ]);

        // Breakdown by Subject
        const subjectBreakdown = await Material.aggregate([
            { $group: { _id: '$subject', count: { $sum: 1 }, totalDownloads: { $sum: '$download_count' } } },
            { $sort: { count: -1 } },
            { $limit: 8 }
        ]);

        res.json({
            totalMaterials,
            totalUsers,
            totalAnnouncements,
            totalMessages,
            totalReviews,
            totalDownloads,
            totalViews,
            gradeBreakdown,
            subjectBreakdown
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== MARKETPLACE API ====

// Admin route helper — requires admin role (already applied via adminMiddleware)

// Admin Login (standalone - no Bearer token needed, uses username/password)
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    try {
        const user = await User.findOne({
            email: new RegExp('^' + String(username) + '$', 'i'),
            password: String(password),
            role: 'admin'
        });
        if (!user) return res.status(401).json({ error: 'Invalid admin credentials' });
        res.json({ token: user._id.toString(), business_name: user.business_name });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin Stats
app.get('/api/admin/stats', async (req, res) => {
    // Auth via Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const token = authHeader.split(' ')[1];
        const adminUser = await User.findOne({ _id: token, role: 'admin' });
        if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

        const totalPdfs = await Material.countDocuments({});
        const totalDownloadsAgg = await Material.aggregate([{ $group: { _id: null, total: { $sum: '$download_count' } } }]);
        const totalDownloads = totalDownloadsAgg.length > 0 ? totalDownloadsAgg[0].total : 0;
        const totalProducts = await Product.countDocuments({});
        const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });

        res.json({ totalPdfs, totalDownloads, totalProducts, totalUsers });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Get all PDFs/Materials
app.get('/api/admin/pdfs', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const token = authHeader.split(' ')[1];
        const adminUser = await User.findOne({ _id: token, role: 'admin' });
        if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

        const materials = await Material.find({}).sort({ created_at: -1 }).populate('user_id', 'business_name email');
        const mapped = materials.map(m => ({
            _id: m._id.toString(),
            title: m.title,
            category: m.subject,
            grade: m.grade ? `Grade ${m.grade}` : 'N/A',
            material_type: m.material_type,
            description: m.description,
            driveUrl: m.file_data,
            file_name: m.file_name,
            downloads: m.download_count,
            isPublished: true,
            created_at: m.created_at,
            publisher: m.user_id ? m.user_id.business_name : 'Admin'
        }));
        res.json(mapped);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Create PDF/Material
app.post('/api/admin/pdfs', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const token = authHeader.split(' ')[1];
        const adminUser = await User.findOne({ _id: token, role: 'admin' });
        if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

        const { title, category, grade, driveUrl, material_type, description } = req.body;
        if (!title || !driveUrl) return res.status(400).json({ error: 'Title and Drive URL are required' });

        // Parse grade: accept "Grade 11" or just "11" or "A/L"
        let gradeNum = 10; // default
        if (grade) {
            const match = String(grade).match(/(\d+)/);
            if (match) gradeNum = Math.min(13, Math.max(1, parseInt(match[1], 10)));
        }

        const material = await Material.create({
            user_id: adminUser._id,
            title: String(title),
            grade: gradeNum,
            subject: String(category || 'General'),
            material_type: ['Short Notes', 'Paper (PDF)', 'Extracurricular Notes'].includes(material_type) ? material_type : 'Paper (PDF)',
            description: String(description || ''),
            file_data: String(driveUrl),
            file_name: String(title)
        });
        res.status(201).json({ message: 'PDF added successfully', id: material._id.toString() });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Update PDF/Material
app.put('/api/admin/pdfs/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const token = authHeader.split(' ')[1];
        const adminUser = await User.findOne({ _id: token, role: 'admin' });
        if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

        const { title, category, grade, driveUrl, material_type, description } = req.body;
        const updateData = {};
        if (title) updateData.title = String(title);
        if (category) updateData.subject = String(category);
        if (grade) {
            const match = String(grade).match(/(\d+)/);
            if (match) updateData.grade = Math.min(13, Math.max(1, parseInt(match[1], 10)));
        }
        if (driveUrl) updateData.file_data = String(driveUrl);
        if (material_type) updateData.material_type = material_type;
        if (description !== undefined) updateData.description = String(description);

        const material = await Material.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!material) return res.status(404).json({ error: 'Material not found' });
        res.json({ message: 'PDF updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Delete PDF/Material
app.delete('/api/admin/pdfs/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const token = authHeader.split(' ')[1];
        const adminUser = await User.findOne({ _id: token, role: 'admin' });
        if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

        const material = await Material.findByIdAndDelete(req.params.id);
        if (!material) return res.status(404).json({ error: 'Material not found' });
        res.json({ message: 'PDF deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Get Ad Settings
app.get('/api/admin/ads', async (req, res) => {
    try {
        let settings = await AdSettings.findOne({ _id: 'global' });
        if (!settings) settings = { monetagDirectLink: '', topBannerCode: '', bottomBannerCode: '' };
        res.json(settings);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Save Ad Settings
app.put('/api/admin/ads', adminMiddleware, async (req, res) => {
    try {
        const { monetagDirectLink, topBannerCode, bottomBannerCode } = req.body;
        await AdSettings.findOneAndUpdate(
            { _id: 'global' },
            { monetagDirectLink, topBannerCode, bottomBannerCode, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        // Log action
        await ActivityLog.create({
            user_id: req.user._id.toString(),
            user_email: req.user.email,
            action: 'Updated Ad Settings',
            details: `Monetag link: ${monetagDirectLink ? 'set' : 'cleared'}`
        });
        res.json({ message: 'Ad settings saved successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Get Site Settings
app.get('/api/admin/site-settings', adminMiddleware, async (req, res) => {
    try {
        let settings = await SiteSettings.findOne({ _id: 'global' });
        if (!settings) settings = { siteName: 'EduPortal Sri Lanka', contactWhatsApp: '' };
        res.json(settings);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Save Site Settings
app.put('/api/admin/site-settings', adminMiddleware, async (req, res) => {
    try {
        const { siteName, contactWhatsApp } = req.body;
        await SiteSettings.findOneAndUpdate(
            { _id: 'global' },
            { siteName, contactWhatsApp, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        // Log action
        await ActivityLog.create({
            user_id: req.user._id.toString(),
            user_email: req.user.email,
            action: 'Updated Site Settings',
            details: `Site name set to: ${siteName}`
        });
        res.json({ message: 'Site settings saved successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Get all marketplace users
app.get('/api/admin/marketplace', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const token = authHeader.split(' ')[1];
        const adminUser = await User.findOne({ _id: token, role: 'admin' });
        if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

        const users = await User.find({ role: { $ne: 'admin' } }).select('-password').sort({ business_name: 1 });
        const result = await Promise.all(users.map(async u => {
            const materialCount = await Material.countDocuments({ user_id: u._id });
            const downloadAgg = await Material.aggregate([{ $match: { user_id: u._id } }, { $group: { _id: null, total: { $sum: '$download_count' } } }]);
            return {
                id: u._id.toString(),
                business_name: u.business_name,
                email: u.email,
                whatsapp_number: u.whatsapp_number,
                status: u.status,
                marketplace_enabled: u.marketplace_enabled,
                materialCount,
                totalDownloads: downloadAgg.length > 0 ? downloadAgg[0].total : 0
            };
        }));
        res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Admin: Toggle marketplace access for user
app.put('/api/admin/marketplace/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const token = authHeader.split(' ')[1];
        const adminUser = await User.findOne({ _id: token, role: 'admin' });
        if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

        const { marketplace_enabled, status } = req.body;
        const updateData = {};
        if (marketplace_enabled !== undefined) updateData.marketplace_enabled = marketplace_enabled;
        if (status !== undefined) updateData.status = status;

        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== ORIGINAL MARKETPLACE API ====

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

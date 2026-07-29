const mongoose = require('mongoose');

// Global variable to cache the mongoose connection
let cachedDb = null;

const connectDB = async () => {
    if (cachedDb) {
        console.log('Using cached MongoDB connection');
        return cachedDb;
    }

    try {
        const uri = process.env.MONGO_URI || 'mongodb+srv://ZTX:Lex%40249TT@cluster0.fcn5pp0.mongodb.net/?appName=Cluster0';
        const db = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000 // Tweak timeout down so Serverless fails faster instead of hanging
        });
        
        cachedDb = db;
        console.log('Connected to MongoDB database');
        return db;
    } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
        throw err; // don't process.exit(1) in serverless!
    }
};

// -- SCHEMAS --

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    business_name: { type: String, required: true },
    whatsapp_number: { type: String },
    marketplace_enabled: { type: Boolean, default: false },
    role: { type: String, default: 'user' },
    status: { type: String, default: 'pending' },
    profile_picture: { type: String, default: '' },
    bank_details: { type: String, default: '' }
});

const CategorySchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true }
});

const ProductSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, default: 'General' },
    name: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    price: { type: Number, default: 0.0 },
    image: { type: String }
});

const InvoiceItemSchema = new mongoose.Schema({
    product_name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    subtotal: { type: Number, required: true }
});

const InvoiceSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    invoice_number: { type: String, required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    time: { type: String, required: true }, // Format: HH:MM
    customer_name: { type: String, default: '' },
    customer_number: { type: String, default: '' },
    business_details: {
        name: String,
        email: String,
        whatsapp: String,
        bank_details: String
    },
    sub_total: { type: Number, default: 0.0 },
    discount: { type: Number, default: 0.0 },
    delivery_fee: { type: Number, default: 0.0 },
    total_amount: { type: Number, default: 0.0 },
    advance_payment: { type: Number, default: 0.0 },
    balance: { type: Number, default: 0.0 },
    items: [InvoiceItemSchema]
});

const MaterialSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    grade: { type: Number, required: true, min: 1, max: 13 },
    subject: { type: String, required: true },
    material_type: { type: String, required: true, enum: ['Short Notes', 'Paper (PDF)', 'Extracurricular Notes'] },
    description: { type: String, default: '' },
    file_data: { type: String, default: '' },
    file_name: { type: String, default: '' },
    download_count: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now }
});

const AdSettingsSchema = new mongoose.Schema({
    _id: { type: String, default: 'global' },
    monetagDirectLink: { type: String, default: '' },
    topBannerCode: { type: String, default: '' },
    bottomBannerCode: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

const SiteSettingsSchema = new mongoose.Schema({
    _id: { type: String, default: 'global' },
    siteName: { type: String, default: 'EduPortal Sri Lanka' },
    contactWhatsApp: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

const Category = mongoose.model('Category', CategorySchema);
const Project = null; // Removed if any project specific logic is there, but here I see models.

// -- MODELS --
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);
const Material = mongoose.model('Material', MaterialSchema);
const AdSettings = mongoose.model('AdSettings', AdSettingsSchema);
const SiteSettings = mongoose.model('SiteSettings', SiteSettingsSchema);

// Create default admin user
const initializeDatabase = async () => {
    try {
        const adminExists = await User.findOne({ email: 'ZTX' });
        if (!adminExists) {
            await User.create({
                email: 'ZTX',
                password: 'BN23@123x',
                business_name: 'Admin Portal',
                role: 'admin',
                status: 'approved'
            });
            console.log('Admin user created.');
        } else {
            await User.updateOne({ email: 'ZTX' }, { role: 'admin', status: 'approved', password: 'BN23@123x' });
            console.log('Admin role/status/password updated for existing admin user.');
        }

        // Ensure legacy users without a status are grandfathered in as 'approved'
        const legacyUpdate = await User.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'approved' } }
        );
        if (legacyUpdate.modifiedCount > 0) {
            console.log(`Grandfathered ${legacyUpdate.modifiedCount} legacy users to 'approved' status.`);
        }
    } catch (err) {
        console.error('Error initializing default user:', err.message);
    }
};

module.exports = {
    connectDB,
    initializeDatabase,
    User,
    Product,
    Invoice,
    Category,
    Material,
    AdSettings,
    SiteSettings
};

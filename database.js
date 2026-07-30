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
    view_count: { type: Number, default: 0 },
    status: { type: String, default: 'published', enum: ['published', 'draft', 'pending', 'hidden'] },
    is_featured: { type: Boolean, default: false },
    author_name: { type: String, default: 'EduPortal' },
    created_at: { type: Date, default: Date.now }
});

const AnnouncementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    target_grade: { type: String, default: 'all' },
    status: { type: String, default: 'active', enum: ['active', 'archived'] },
    created_at: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, default: 'General Inquiry' },
    message: { type: String, required: true },
    status: { type: String, default: 'unread', enum: ['unread', 'read', 'replied'] },
    created_at: { type: Date, default: Date.now }
});

const ReviewSchema = new mongoose.Schema({
    material_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    material_title: { type: String, default: 'General Review' },
    user_name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    status: { type: String, default: 'approved', enum: ['approved', 'pending', 'hidden'] },
    created_at: { type: Date, default: Date.now }
});

const ActivityLogSchema = new mongoose.Schema({
    user_id: { type: String, default: 'System' },
    user_email: { type: String, default: 'admin@eduportal.lk' },
    action: { type: String, required: true },
    details: { type: String, default: '' },
    created_at: { type: Date, default: Date.now }
});

const MediaItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    file_type: { type: String, default: 'image' },
    file_size: { type: String, default: '0 KB' },
    created_at: { type: Date, default: Date.now }
});

const SeoSettingsSchema = new mongoose.Schema({
    _id: { type: String, default: 'global' },
    metaTitle: { type: String, default: 'EduPortal Sri Lanka | Grades 1-13 Notes & PDF Papers' },
    metaDescription: { type: String, default: 'Download free educational short notes, term papers, and model answers for Grades 1 to 13 in Sri Lanka.' },
    metaKeywords: { type: String, default: 'Education, Notes, PDF, Sri Lanka, Grade 11, Grade 13, O/L, A/L, Past Papers' },
    ogImage: { type: String, default: '' },
    robots: { type: String, default: 'index, follow' },
    updatedAt: { type: Date, default: Date.now }
});

const SubjectSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    code: { type: String, default: '' },
    category: { type: String, default: 'General' },
    created_at: { type: Date, default: Date.now }
});

const GradeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    level: { type: Number, required: true, min: 1, max: 13 },
    stream: { type: String, default: 'General' }
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
    logoUrl: { type: String, default: '' },
    footerText: { type: String, default: '© 2026 EduPortal Sri Lanka. All Rights Reserved.' },
    updatedAt: { type: Date, default: Date.now }
});

// -- MODELS --
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);
const Category = mongoose.model('Category', CategorySchema);
const Material = mongoose.model('Material', MaterialSchema);
const Announcement = mongoose.model('Announcement', AnnouncementSchema);
const Message = mongoose.model('Message', MessageSchema);
const Review = mongoose.model('Review', ReviewSchema);
const ActivityLog = mongoose.model('ActivityLog', ActivityLogSchema);
const MediaItem = mongoose.model('MediaItem', MediaItemSchema);
const SeoSettings = mongoose.model('SeoSettings', SeoSettingsSchema);
const Subject = mongoose.model('Subject', SubjectSchema);
const Grade = mongoose.model('Grade', GradeSchema);
const AdSettings = mongoose.model('AdSettings', AdSettingsSchema);
const SiteSettings = mongoose.model('SiteSettings', SiteSettingsSchema);

// Create default admin user and default subjects/announcements
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
            await User.updateOne({ email: 'ZTX', role: 'admin' }, { status: 'approved', password: 'BN23@123x' });
            console.log('Admin role/status/password updated for existing admin user.');
        }

        // Ensure default announcement if none exist
        const annCount = await Announcement.countDocuments();
        if (annCount === 0) {
            await Announcement.create({
                title: 'Welcome to EduPortal Sri Lanka!',
                content: 'Access short notes, past papers, and study resources for Grades 1 to 13.',
                target_grade: 'all',
                status: 'active'
            });
        }

        // Ensure default activity log
        const logCount = await ActivityLog.countDocuments();
        if (logCount === 0) {
            await ActivityLog.create({
                user_id: 'System',
                user_email: 'admin@eduportal.lk',
                action: 'System Initialized',
                details: 'Educational Notes & Marketplace platform ready.'
            });
        }
    } catch (err) {
        console.error('Error initializing default data:', err.message);
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
    Announcement,
    Message,
    Review,
    ActivityLog,
    MediaItem,
    SeoSettings,
    Subject,
    Grade,
    AdSettings,
    SiteSettings
};

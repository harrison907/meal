const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// 新增：添加额外的安全配置
const rateLimit = require('express-rate-limit'); // 需要安装：npm install express-rate-limit
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kitchen";

mongoose.connect(MONGO_URI).then(() => console.log("✅ 数据库连接成功"));

// --- 数据库模型 ---
const Dish = mongoose.models.Dish || mongoose.model('Dish', {
    name: String, emoji: String, price: { type: Number, default: 0 },
    category: String, isApproved: { type: Boolean, default: false }
});

const Order = mongoose.models.Order || mongoose.model('Order', {
    items: Array, status: { type: String, default: 'waiting' },
    totalPrice: Number, rating: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', { balance: { type: Number, default: 100 } });
const Message = mongoose.models.Message || mongoose.model('Message', { 
    sender: String, content: String, createdAt: { type: Date, default: Date.now } 
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));

// 添加日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// 限制请求频率
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100 // 限制每个IP 100次请求
});
app.use('/api/', limiter);

// 错误处理中间件（放在最后）
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
});

// --- API 接口 ---
app.get('/api/wallet', async (req, res) => {
    let w = await Wallet.findOne();
    if (!w) w = await Wallet.create({ balance: 100 });
    res.json(w);
});

app.post('/api/wallet/recharge', async (req, res) => {
    await Wallet.updateOne({}, { $inc: { balance: req.body.amount } }, { upsert: true });
    res.json({ success: true });
});

// --- server.js 里的对应部分修改 ---
app.get('/api/menu', async (req, res) => {
    try {
        let menu = await Dish.find();
        if (menu.length === 0) {
            // 确保初始菜品 isApproved 为 true，否则前厅看不见
            menu = await Dish.insertMany([
                { name: "爱心煎蛋", emoji: "🍳", category: "breakfast", time: 5, price: 10, isApproved: true },
                { name: "浪漫意面", emoji: "🍝", category: "lunch", time: 20, price: 25, isApproved: true }
            ]);
        }
        res.json(menu);
    } catch (e) { res.status(500).json(e); }
});
app.post('/api/menu', async (req, res) => res.json(await new Dish(req.body).save()));
app.put('/api/menu/:id', async (req, res) => res.json(await Dish.findByIdAndUpdate(req.params.id, req.body)));
app.delete('/api/menu/:id', async (req, res) => res.json(await Dish.findByIdAndDelete(req.params.id)));

app.post('/api/order', async (req, res) => {
    const { items } = req.body;
    const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const wallet = await Wallet.findOne();
    if (wallet.balance < total) return res.status(400).json({ success: false, message: "余额不足" });
    wallet.balance -= total; await wallet.save();
    const order = await new Order({ items, totalPrice: total }).save();
    res.json({ success: true, order });
});

app.get('/api/orders', async (req, res) => res.json(await Order.find().sort({ createdAt: -1 })));
app.put('/api/order/:id', async (req, res) => res.json(await Order.findByIdAndUpdate(req.params.id, { status: req.body.status })));
app.put('/api/order/:id/rate', async (req, res) => res.json(await Order.findByIdAndUpdate(req.params.id, { rating: req.body.rating })));

app.get('/api/messages', async (req, res) => res.json(await Message.find().sort({ createdAt: 1 }).limit(50)));
app.post('/api/messages', async (req, res) => res.json(await new Message(req.body).save()));

app.get('/chef', (req, res) => res.sendFile(path.join(__dirname, './public/chef.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));

app.listen(PORT, () => console.log(`🚀 餐厅系统运行中: ${PORT}`));



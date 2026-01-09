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
// 1. 菜品：增加 price 字段
const Dish = mongoose.models.Dish || mongoose.model('Dish', {
    name: String, emoji: String, category: String, time: Number, price: { type: Number, default: 0 }
});

// 2. 订单
const Order = mongoose.models.Order || mongoose.model('Order', {
    items: Array, status: { type: String, default: 'waiting' },
    totalPrice: Number, rating: { type: Number, default: 0 }, createdAt: { type: Date, default: Date.now }
});

// 3. 钱包 (只有一个全局钱包，代表前厅的钱)
const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', {
    balance: { type: Number, default: 100 } // 初始给100块
});

// 4. 聊天记录
const Message = mongoose.models.Message || mongoose.model('Message', {
    sender: String, content: String, createdAt: { type: Date, default: Date.now }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));

// --- API 接口 ---

// 钱包相关
app.get('/api/wallet', async (req, res) => {
    let w = await Wallet.findOne();
    if (!w) w = await Wallet.create({ balance: 100 });
    res.json(w);
});

// 充值 (后厨专用)
app.post('/api/wallet/recharge', async (req, res) => {
    const { amount } = req.body;
    await Wallet.updateOne({}, { $inc: { balance: amount } }, { upsert: true });
    res.json({ success: true });
});

// 菜品相关
app.get('/api/menu', async (req, res) => {
    res.json(await Dish.find());
});

app.post('/api/menu', async (req, res) => {
    const dish = new Dish(req.body);
    await dish.save();
    res.json(dish);
});

app.delete('/api/menu/:id', async (req, res) => {
    await Dish.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// 订单相关 (带金额检查)
app.post('/api/order', async (req, res) => {
    const { items } = req.body;
    const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    const wallet = await Wallet.findOne();
    if (wallet.balance < total) {
        return res.status(400).json({ success: false, message: "余额不足，快去找TA充值吧！" });
    }

    // 扣费
    wallet.balance -= total;
    await wallet.save();

    const order = new Order({ items, totalPrice: total });
    await order.save();
    res.json({ success: true, order });
});

app.get('/api/orders', async (req, res) => {
    res.json(await Order.find().sort({ createdAt: -1 }));
});

app.put('/api/order/:id', async (req, res) => {
    await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
});

// 聊天相关
app.get('/api/messages', async (req, res) => {
    res.json(await Message.find().sort({ createdAt: 1 }).limit(50));
});

app.post('/api/messages', async (req, res) => {
    const msg = new Message(req.body);
    await msg.save();
    res.json(msg);
});

app.get('/chef', (req, res) => res.sendFile(path.join(__dirname, './public/chef.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));

app.listen(PORT, () => console.log(`🚀 餐厅已升级: ${PORT}`));

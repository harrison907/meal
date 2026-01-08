const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8080;

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kitchen";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ 数据库连接成功"))
    .catch(err => console.error("❌ 数据库连接失败:", err));

// --- 数据库模型 (增加防重定义逻辑) ---
const Dish = mongoose.models.Dish || mongoose.model('Dish', {
    name: String, emoji: String, category: String, time: Number
});

const Order = mongoose.models.Order || mongoose.model('Order', {
    items: Array, 
    status: { type: String, default: 'waiting' },
    rating: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));

// --- API 接口 ---
app.get('/api/menu', async (req, res) => {
    try {
        let menu = await Dish.find();
        // 如果数据库没菜，自动加两个，防止页面空白
        if (menu.length === 0) {
            menu = await Dish.insertMany([
                { name: "爱心煎蛋", emoji: "🍳", category: "breakfast", time: 5 },
                { name: "浪漫意面", emoji: "🍝", category: "lunch", time: 20 }
            ]);
        }
        res.json(menu);
    } catch (e) { res.status(500).json(e); }
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

app.post('/api/order', async (req, res) => {
    const order = new Order(req.body);
    await order.save();
    res.json(order);
});

app.get('/api/orders', async (req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
});

app.put('/api/order/:id', async (req, res) => {
    await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
});

app.put('/api/order/:id/rate', async (req, res) => {
    await Order.findByIdAndUpdate(req.params.id, { rating: req.body.rating });
    res.json({ success: true });
});

app.get('/chef', (req, res) => res.sendFile(path.join(__dirname, './public/chef.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));

app.listen(PORT, () => console.log(`🚀 服务启动: ${PORT}`));

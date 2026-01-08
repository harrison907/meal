const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8080;

// 【关键修改】使用你截图中的 MONGO_URI 变量
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kitchen";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ 数据库连接成功"))
    .catch(err => console.error("❌ 数据库连接失败:", err));

// 定义数据库模型
const Dish = mongoose.model('Dish', {
    name: String,
    emoji: String,
    category: String,
    time: Number,
    difficulty: { type: String, default: "★★★☆☆" }
});

const Order = mongoose.model('Order', {
    items: Array,
    status: { type: String, default: 'waiting' },
    createdAt: { type: Date, default: Date.now }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));

// --- 菜品 API ---
app.get('/api/menu', async (req, res) => {
    try {
        const menu = await Dish.find();
        if (menu.length === 0) {
            // 初始默认菜品
            const defaults = [
                { name: "爱心煎蛋", category: "breakfast", time: 5, emoji: "🍳" },
                { name: "浪漫意面", category: "lunch", time: 25, emoji: "🍝" }
            ];
            await Dish.insertMany(defaults);
            return res.json(defaults);
        }
        res.json(menu);
    } catch (e) { res.status(500).send(e); }
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

// --- 订单 API ---
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

app.get('*', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));

app.listen(PORT, () => console.log(`🚀 服务运行在端口: ${PORT}`));

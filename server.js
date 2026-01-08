const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8080;

// 使用你截图中的环境变量 MONGO_URI
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kitchen";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ 数据库连接成功"))
    .catch(err => console.error("❌ 数据库连接失败:", err));

// --- 数据库模型 (只定义一次，防止报错) ---
const Dish = mongoose.model('Dish', {
    name: String, emoji: String, category: String, time: Number
});

const Order = mongoose.model('Order', {
    items: Array, 
    status: { type: String, default: 'waiting' },
    rating: { type: Number, default: 0 }, // 存储评分 1-5
    createdAt: { type: Date, default: Date.now }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));

// --- API 接口 ---

// 1. 获取菜单
app.get('/api/menu', async (req, res) => {
    const menu = await Dish.find();
    res.json(menu);
});

// 2. 添加菜品
app.post('/api/menu', async (req, res) => {
    const dish = new Dish(req.body);
    await dish.save();
    res.json(dish);
});

// 3. 删除菜品
app.delete('/api/menu/:id', async (req, res) => {
    await Dish.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// 4. 提交订单
app.post('/api/order', async (req, res) => {
    const order = new Order(req.body);
    await order.save();
    res.json(order);
});

// 5. 获取订单
app.get('/api/orders', async (req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
});

// 6. 更新订单状态 (后厨用)
app.put('/api/order/:id', async (req, res) => {
    await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
});

// 7. 评价订单 (前厅用)
app.put('/api/order/:id/rate', async (req, res) => {
    await Order.findByIdAndUpdate(req.params.id, { rating: req.body.rating });
    res.json({ success: true });
});

// --- 路由配置 ---
app.get('/chef', (req, res) => res.sendFile(path.join(__dirname, './public/chef.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));

app.listen(PORT, () => console.log(`🚀 服务运行在: ${PORT}`));

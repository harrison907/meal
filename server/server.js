const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// 模拟数据库
let orders = [];
let menu = [
    { id: 1, name: "爱心煎蛋", category: "breakfast", time: 5, emoji: "🍳", difficulty: "★☆☆☆☆" },
    { id: 2, name: "甜蜜三明治", category: "breakfast", time: 10, emoji: "🥪", difficulty: "★☆☆☆☆" },
    { id: 3, name: "阳光沙拉", category: "lunch", time: 15, emoji: "🥗", difficulty: "★★☆☆☆" },
    { id: 4, name: "浪漫意面", category: "lunch", time: 25, emoji: "🍝", difficulty: "★★★☆☆" },
    { id: 5, name: "幸福咖喱饭", category: "lunch", time: 30, emoji: "🍛", difficulty: "★★★☆☆" }
];

// API路由
app.get('/api/menu', (req, res) => {
    res.json(menu);
});

app.post('/api/order', (req, res) => {
    const order = {
        id: Date.now(),
        ...req.body,
        status: 'waiting',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    orders.push(order);
    res.json({ success: true, orderId: order.id });
});

app.get('/api/orders', (req, res) => {
    res.json(orders);
});

app.put('/api/order/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const order = orders.find(o => o.id == id);
    if (order) {
        order.status = status;
        order.updatedAt = new Date().toISOString();
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: '订单不存在' });
    }
});

// 默认路由 - 返回前端页面
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`手机访问：请确保在同一WiFi下，访问你的IP地址:${PORT}`);
});
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));

// --- 模拟数据库 ---
let orders = [];
let menu = [
    { id: 1, name: "爱心煎蛋", category: "breakfast", time: 5, emoji: "🍳", difficulty: "★☆☆☆☆" },
    { id: 2, name: "甜蜜三明治", category: "breakfast", time: 10, emoji: "🥪", difficulty: "★☆☆☆☆" },
    { id: 3, name: "阳光沙拉", category: "lunch", time: 15, emoji: "🥗", difficulty: "★★☆☆☆" },
    { id: 4, name: "浪漫意面", category: "lunch", time: 25, emoji: "🍝", difficulty: "★★★☆☆" },
    { id: 5, name: "幸福咖喱饭", category: "lunch", time: 30, emoji: "🍛", difficulty: "★★★☆☆" }
];

// --- 菜品管理 API (新增/修改/删除) ---

// 1. 获取所有菜品
app.get('/api/menu', (req, res) => {
    res.json(menu);
});

// 2. 添加新菜品 (新增)
app.post('/api/menu', (req, res) => {
    const newDish = {
        id: Date.now(), // 简单用时间戳做ID
        ...req.body
    };
    menu.push(newDish);
    res.json({ success: true, dish: newDish });
});

// 3. 修改菜品 (修改)
app.put('/api/menu/:id', (req, res) => {
    const { id } = req.params;
    const index = menu.findIndex(d => d.id == id);
    if (index !== -1) {
        menu[index] = { ...menu[index], ...req.body };
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: '菜品未找到' });
    }
});

// 4. 删除菜品 (删除)
app.delete('/api/menu/:id', (req, res) => {
    const { id } = req.params;
    menu = menu.filter(d => d.id != id);
    res.json({ success: true });
});

// --- 订单 API ---
app.post('/api/order', (req, res) => {
    const order = { id: Date.now(), ...req.body, status: 'waiting', createdAt: new Date().toISOString() };
    orders.push(order);
    res.json({ success: true, orderId: order.id });
});

app.get('/api/orders', (req, res) => res.json(orders));

// --- 默认页面 ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, './public/index.html'));
});

app.listen(PORT, () => {
    console.log(`服务器已启动，接口已就绪: ${PORT}`);
});

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
// Zeabur 等云平台会自动提供 PORT 环境变量，如果没有则默认使用 8080
const PORT = process.env.PORT || 8080;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());

/**
 * 【重要修改】
 * 因为 server.js 现在在根目录，与 public 文件夹平级
 * 路径从 '../public' 改为 './public'
 */
app.use(express.static(path.join(__dirname, './public')));

// 模拟数据库（内存存储，重启服务会重置）
let orders = [];
let menu = [
    { id: 1, name: "爱心煎蛋", category: "breakfast", time: 5, emoji: "🍳", difficulty: "★☆☆☆☆" },
    { id: 2, name: "甜蜜三明治", category: "breakfast", time: 10, emoji: "🥪", difficulty: "★☆☆☆☆" },
    { id: 3, name: "阳光沙拉", category: "lunch", time: 15, emoji: "🥗", difficulty: "★★☆☆☆" },
    { id: 4, name: "浪漫意面", category: "lunch", time: 25, emoji: "🍝", difficulty: "★★★☆☆" },
    { id: 5, name: "幸福咖喱饭", category: "lunch", time: 30, emoji: "🍛", difficulty: "★★★☆☆" }
];

// --- API 路由开始 ---

// 获取菜单
app.get('/api/menu', (req, res) => {
    res.json(menu);
});

// 提交订单
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

// 获取所有订单
app.get('/api/orders', (req, res) => {
    res.json(orders);
});

// 更新订单状态
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

// --- API 路由结束 ---

/**
 * 【重要修改】
 * 默认路由 - 当访问非 API 路径时，返回前端 index.html 页面
 * 路径从 '../public/index.html' 改为 './public/index.html'
 */
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, './public/index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 服务器已启动！`);
    console.log(`端口: ${PORT}`);
    console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=================================`);
});

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kitchen";

// 优化数据库连接
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
}).then(() => console.log("✅ 数据库连接成功"))
  .catch(err => console.error("❌ 数据库连接失败:", err));

// --- 数据库模型 ---
const Dish = mongoose.models.Dish || mongoose.model('Dish', {
    name: String, 
    emoji: String, 
    price: { type: Number, default: 0 },
    category: String, 
    isApproved: { type: Boolean, default: false }
});

const Order = mongoose.models.Order || mongoose.model('Order', {
    items: Array, 
    status: { type: String, default: 'waiting' },
    totalPrice: Number, 
    rating: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', { 
    balance: { type: Number, default: 100 } 
});

const Message = mongoose.models.Message || mongoose.model('Message', { 
    sender: String, 
    content: String, 
    createdAt: { type: Date, default: Date.now } 
});

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));

// 添加日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// --- API 接口 ---
app.get('/api/wallet', async (req, res) => {
    try {
        let w = await Wallet.findOne();
        if (!w) w = await Wallet.create({ balance: 100 });
        res.json(w);
    } catch (error) {
        console.error('获取钱包失败:', error);
        res.status(500).json({ success: false, message: '获取钱包信息失败' });
    }
});

app.post('/api/wallet/recharge', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: "充值金额无效" 
            });
        }
        
        await Wallet.updateOne({}, { $inc: { balance: parseFloat(amount) } }, { upsert: true });
        res.json({ success: true });
    } catch (error) {
        console.error('充值失败:', error);
        res.status(500).json({ success: false, message: '充值失败' });
    }
});

// 菜品接口
app.get('/api/menu', async (req, res) => {
    try {
        let menu = await Dish.find();
        if (menu.length === 0) {
            // 确保初始菜品 isApproved 为 true，否则前厅看不见
            menu = await Dish.insertMany([
                { name: "爱心煎蛋", emoji: "🍳", category: "breakfast", price: 10, isApproved: true },
                { name: "浪漫意面", emoji: "🍝", category: "lunch", price: 25, isApproved: true }
            ]);
        }
        res.json(menu);
    } catch (e) { 
        console.error('获取菜单失败:', e);
        res.status(500).json({ success: false, message: '获取菜单失败' });
    }
});

app.post('/api/menu', async (req, res) => {
    try {
        const dish = await new Dish(req.body).save();
        res.json(dish);
    } catch (error) {
        console.error('添加菜品失败:', error);
        res.status(500).json({ success: false, message: '添加菜品失败' });
    }
});

app.put('/api/menu/:id', async (req, res) => {
    try {
        const dish = await Dish.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(dish);
    } catch (error) {
        console.error('更新菜品失败:', error);
        res.status(500).json({ success: false, message: '更新菜品失败' });
    }
});

app.delete('/api/menu/:id', async (req, res) => {
    try {
        const result = await Dish.findByIdAndDelete(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('删除菜品失败:', error);
        res.status(500).json({ success: false, message: '删除菜品失败' });
    }
});

// 订单验证中间件
const validateOrder = (req, res, next) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: "订单不能为空" 
        });
    }
    next();
};

// 使用验证中间件
app.post('/api/order', validateOrder, async (req, res) => {
    try {
        const { items } = req.body;
        
        // 更安全的数值计算
        const total = items.reduce((sum, i) => {
            const price = parseFloat(i.price) || 0;
            const quantity = parseInt(i.quantity) || 0;
            return sum + (price * quantity);
        }, 0);
        
        // 验证总金额
        if (total <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: "订单金额无效" 
            });
        }
        
        // 获取钱包并验证
        const wallet = await Wallet.findOne();
        if (!wallet) {
            return res.status(500).json({ 
                success: false, 
                message: "钱包系统错误" 
            });
        }
        
        // 更友好的余额不足提示
        if (wallet.balance < total) {
            return res.status(400).json({ 
                success: false, 
                message: `余额不足，当前余额: ￥${wallet.balance.toFixed(2)}，需要: ￥${total.toFixed(2)}` 
            });
        }
        
        // 精确计算并保存
        wallet.balance = parseFloat((wallet.balance - total).toFixed(2));
        await wallet.save();
        
        // 创建订单
        const order = await new Order({ 
            items, 
            totalPrice: total,
            status: 'waiting',
            rating: 0,
            createdAt: new Date()
        }).save();
        
        res.json({ success: true, order });
    } catch (error) {
        console.error('下单失败:', error);
        res.status(500).json({ 
            success: false, 
            message: "下单失败，请稍后重试" 
        });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error('获取订单失败:', error);
        res.status(500).json({ success: false, message: '获取订单失败' });
    }
});

app.put('/api/order/:id', async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.id, 
            { status: req.body.status }, 
            { new: true }
        );
        res.json(order);
    } catch (error) {
        console.error('更新订单状态失败:', error);
        res.status(500).json({ success: false, message: '更新订单状态失败' });
    }
});

app.put('/api/order/:id/rate', async (req, res) => {
    try {
        const { rating } = req.body;
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false, 
                message: "评分必须在1-5之间" 
            });
        }
        
        const order = await Order.findByIdAndUpdate(
            req.params.id, 
            { rating }, 
            { new: true }
        );
        res.json(order);
    } catch (error) {
        console.error('评分失败:', error);
        res.status(500).json({ success: false, message: '评分失败' });
    }
});

// 消息接口
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ createdAt: 1 }).limit(50);
        res.json(messages);
    } catch (error) {
        console.error('获取消息失败:', error);
        res.status(500).json({ success: false, message: '获取消息失败' });
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const { sender, content } = req.body;
        if (!sender || !content) {
            return res.status(400).json({ 
                success: false, 
                message: "发送者和内容不能为空" 
            });
        }
        
        const message = await new Message({ sender, content }).save();
        res.json(message);
    } catch (error) {
        console.error('发送消息失败:', error);
        res.status(500).json({ success: false, message: '发送消息失败' });
    }
});

// 页面路由
app.get('/chef', (req, res) => {
    res.sendFile(path.join(__dirname, './public/chef.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, './public/index.html'));
});

// 错误处理中间件（放在最后）
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.listen(PORT, () => console.log(`🚀 餐厅系统运行中: ${PORT}`));

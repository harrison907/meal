const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8080;

// 从环境变量获取 MongoDB 连接字符串
// Zeabur 会自动提供 MONGODB_URI 环境变量
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kitchen";

// 优化数据库连接
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log("✅ MongoDB 数据库连接成功"))
.catch(err => {
    console.error("❌ MongoDB 数据库连接失败:", err);
    console.log("⚠️  使用内存存储作为备选方案...");
});

// --- 数据库模型 ---
const Dish = mongoose.models.Dish || mongoose.model('Dish', {
    name: String, 
    emoji: String, 
    price: { type: Number, default: 0 },
    category: String, 
    isApproved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
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

// --- 辅助函数：检查数据库连接 ---
const isDatabaseConnected = () => {
    return mongoose.connection.readyState === 1;
};

// 内存存储作为备选方案
let memoryStorage = {
    dishes: [],
    orders: [],
    wallet: { balance: 100 },
    messages: []
};

// 初始化默认菜品
const initializeDefaultDishes = async () => {
    if (isDatabaseConnected()) {
        const count = await Dish.countDocuments();
        if (count === 0) {
            await Dish.insertMany([
                { name: "爱心煎蛋", emoji: "🍳", category: "breakfast", price: 10, isApproved: true },
                { name: "浪漫意面", emoji: "🍝", category: "lunch", price: 25, isApproved: true },
                { name: "甜蜜三明治", emoji: "🥪", category: "breakfast", price: 15, isApproved: true }
            ]);
            console.log("✅ 默认菜品初始化完成");
        }
    } else {
        if (memoryStorage.dishes.length === 0) {
            memoryStorage.dishes = [
                { _id: '1', name: "爱心煎蛋", emoji: "🍳", price: 10, category: "breakfast", isApproved: true },
                { _id: '2', name: "浪漫意面", emoji: "🍝", price: 25, category: "lunch", isApproved: true },
                { _id: '3', name: "甜蜜三明治", emoji: "🥪", price: 15, category: "breakfast", isApproved: true }
            ];
        }
    }
};

// 初始化钱包
const initializeWallet = async () => {
    if (isDatabaseConnected()) {
        const wallet = await Wallet.findOne();
        if (!wallet) {
            await Wallet.create({ balance: 100 });
        }
    }
};

// 应用启动时初始化
initializeDefaultDishes();
initializeWallet();

// --- API 接口 ---
app.get('/api/health', async (req, res) => {
    const dbStatus = isDatabaseConnected() ? 'connected' : 'disconnected';
    res.json({ 
        status: 'ok', 
        message: '情侣厨房服务器运行正常',
        database: dbStatus,
        timestamp: new Date().toISOString()
    });
});

// 钱包接口
app.get('/api/wallet', async (req, res) => {
    try {
        if (isDatabaseConnected()) {
            let wallet = await Wallet.findOne();
            if (!wallet) {
                wallet = await Wallet.create({ balance: 100 });
            }
            res.json(wallet);
        } else {
            res.json(memoryStorage.wallet);
        }
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
        
        if (isDatabaseConnected()) {
            await Wallet.updateOne({}, { $inc: { balance: parseFloat(amount) } }, { upsert: true });
        } else {
            memoryStorage.wallet.balance += parseFloat(amount);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('充值失败:', error);
        res.status(500).json({ success: false, message: '充值失败' });
    }
});

// 菜品接口
app.get('/api/menu', async (req, res) => {
    try {
        if (isDatabaseConnected()) {
            const menu = await Dish.find().sort({ createdAt: -1 });
            res.json(menu);
        } else {
            res.json(memoryStorage.dishes);
        }
    } catch (error) {
        console.error('获取菜单失败:', error);
        res.status(500).json(memoryStorage.dishes);
    }
});

app.post('/api/menu', async (req, res) => {
    try {
        const dishData = req.body;
        
        if (isDatabaseConnected()) {
            const dish = await new Dish(dishData).save();
            res.json(dish);
        } else {
            const newDish = {
                _id: Date.now().toString(),
                ...dishData,
                createdAt: new Date()
            };
            memoryStorage.dishes.push(newDish);
            res.json(newDish);
        }
    } catch (error) {
        console.error('添加菜品失败:', error);
        res.status(500).json({ success: false, message: '添加菜品失败' });
    }
});

app.put('/api/menu/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const updateData = req.body;
        
        if (isDatabaseConnected()) {
            const dish = await Dish.findByIdAndUpdate(id, updateData, { new: true });
            if (!dish) {
                return res.status(404).json({ success: false, message: '菜品未找到' });
            }
            res.json(dish);
        } else {
            const index = memoryStorage.dishes.findIndex(d => d._id === id);
            if (index !== -1) {
                memoryStorage.dishes[index] = { ...memoryStorage.dishes[index], ...updateData };
                res.json(memoryStorage.dishes[index]);
            } else {
                res.status(404).json({ success: false, message: '菜品未找到' });
            }
        }
    } catch (error) {
        console.error('更新菜品失败:', error);
        res.status(500).json({ success: false, message: '更新菜品失败' });
    }
});

app.delete('/api/menu/:id', async (req, res) => {
    try {
        const id = req.params.id;
        
        if (isDatabaseConnected()) {
            const result = await Dish.findByIdAndDelete(id);
            if (!result) {
                return res.status(404).json({ success: false, message: '菜品未找到' });
            }
            res.json(result);
        } else {
            const index = memoryStorage.dishes.findIndex(d => d._id === id);
            if (index !== -1) {
                const deleted = memoryStorage.dishes.splice(index, 1)[0];
                res.json(deleted);
            } else {
                res.status(404).json({ success: false, message: '菜品未找到' });
            }
        }
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

// 订单接口
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
        
        // 获取钱包
        let wallet;
        if (isDatabaseConnected()) {
            wallet = await Wallet.findOne();
            if (!wallet) {
                wallet = await Wallet.create({ balance: 100 });
            }
        } else {
            wallet = memoryStorage.wallet;
        }
        
        // 更友好的余额不足提示
        if (wallet.balance < total) {
            return res.status(400).json({ 
                success: false, 
                message: `余额不足，当前余额: ￥${wallet.balance.toFixed(2)}，需要: ￥${total.toFixed(2)}` 
            });
        }
        
        // 扣款
        wallet.balance = parseFloat((wallet.balance - total).toFixed(2));
        
        if (isDatabaseConnected()) {
            await wallet.save();
        } else {
            memoryStorage.wallet.balance = wallet.balance;
        }
        
        // 创建订单
        const orderData = {
            items,
            totalPrice: total,
            status: 'waiting',
            rating: 0,
            createdAt: new Date()
        };
        
        if (isDatabaseConnected()) {
            const order = await new Order(orderData).save();
            res.json({ success: true, order });
        } else {
            const order = {
                _id: Date.now().toString(),
                ...orderData
            };
            memoryStorage.orders.push(order);
            res.json({ success: true, order });
        }
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
        if (isDatabaseConnected()) {
            const orders = await Order.find().sort({ createdAt: -1 });
            res.json(orders);
        } else {
            // 按创建时间倒序排列
            const sortedOrders = [...memoryStorage.orders].sort((a, b) => 
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            res.json(sortedOrders);
        }
    } catch (error) {
        console.error('获取订单失败:', error);
        res.status(500).json([]);
    }
});

app.put('/api/order/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ success: false, message: '状态不能为空' });
        }
        
        if (isDatabaseConnected()) {
            const order = await Order.findByIdAndUpdate(
                id, 
                { status }, 
                { new: true }
            );
            if (!order) {
                return res.status(404).json({ success: false, message: '订单未找到' });
            }
            res.json(order);
        } else {
            const index = memoryStorage.orders.findIndex(o => o._id === id);
            if (index !== -1) {
                memoryStorage.orders[index].status = status;
                res.json(memoryStorage.orders[index]);
            } else {
                res.status(404).json({ success: false, message: '订单未找到' });
            }
        }
    } catch (error) {
        console.error('更新订单状态失败:', error);
        res.status(500).json({ success: false, message: '更新订单状态失败' });
    }
});

app.put('/api/order/:id/rate', async (req, res) => {
    try {
        const id = req.params.id;
        const { rating } = req.body;
        
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false, 
                message: "评分必须在1-5之间" 
            });
        }
        
        if (isDatabaseConnected()) {
            const order = await Order.findByIdAndUpdate(
                id, 
                { rating }, 
                { new: true }
            );
            if (!order) {
                return res.status(404).json({ success: false, message: '订单未找到' });
            }
            res.json(order);
        } else {
            const index = memoryStorage.orders.findIndex(o => o._id === id);
            if (index !== -1) {
                memoryStorage.orders[index].rating = rating;
                res.json(memoryStorage.orders[index]);
            } else {
                res.status(404).json({ success: false, message: '订单未找到' });
            }
        }
    } catch (error) {
        console.error('评分失败:', error);
        res.status(500).json({ success: false, message: '评分失败' });
    }
});

// 消息接口
app.get('/api/messages', async (req, res) => {
    try {
        if (isDatabaseConnected()) {
            const messages = await Message.find().sort({ createdAt: 1 }).limit(50);
            res.json(messages);
        } else {
            // 限制返回50条消息，按时间正序排列
            const sortedMessages = [...memoryStorage.messages]
                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                .slice(-50);
            res.json(sortedMessages);
        }
    } catch (error) {
        console.error('获取消息失败:', error);
        res.status(500).json([]);
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
        
        const messageData = {
            sender,
            content,
            createdAt: new Date()
        };
        
        if (isDatabaseConnected()) {
            const message = await new Message(messageData).save();
            res.json(message);
        } else {
            const message = {
                _id: Date.now().toString(),
                ...messageData
            };
            memoryStorage.messages.push(message);
            res.json(message);
        }
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

app.listen(PORT, () => {
    console.log(`🚀 情侣厨房服务器运行中: ${PORT}`);
    console.log(`📱 访问地址：http://localhost:${PORT}`);
    console.log(`👨‍🍳 大厨面板：http://localhost:${PORT}/chef`);
    console.log(`🗄️  数据库状态: ${isDatabaseConnected() ? '已连接' : '未连接'}`);
});

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kitchen";

mongoose.connect(MONGO_URI).then(() => console.log("✅ 数据库已连接"));

const Dish = mongoose.models.Dish || mongoose.model('Dish', {
    name: String, emoji: String, price: Number, category: String, time: Number
});

const Order = mongoose.models.Order || mongoose.model('Order', {
    items: Array, status: { type: String, default: 'waiting' },
    totalPrice: Number, createdAt: { type: Date, default: Date.now }
});

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', { balance: Number });
const Message = mongoose.models.Message || mongoose.model('Message', { sender: String, content: String, createdAt: { type: Date, default: Date.now } });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public')));

// 接口
app.get('/api/wallet', async (req, res) => {
    let w = await Wallet.findOne();
    if (!w) w = await Wallet.create({ balance: 100 });
    res.json(w);
});

app.post('/api/wallet/recharge', async (req, res) => {
    await Wallet.updateOne({}, { $inc: { balance: req.body.amount } }, { upsert: true });
    res.json({ success: true });
});

app.get('/api/menu', async (req, res) => res.json(await Dish.find()));
app.post('/api/menu', async (req, res) => res.json(await new Dish(req.body).save()));
app.delete('/api/menu/:id', async (req, res) => res.json(await Dish.findByIdAndDelete(req.params.id)));

app.post('/api/order', async (req, res) => {
    const { items } = req.body;
    const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const wallet = await Wallet.findOne();
    if (wallet.balance < total) return res.status(400).json({ success: false, message: "余额不足，去找TA要钱吧~" });
    wallet.balance -= total;
    await wallet.save();
    const order = await new Order({ items, totalPrice: total }).save();
    res.json({ success: true, order });
});

app.get('/api/orders', async (req, res) => res.json(await Order.find().sort({ createdAt: -1 })));
app.put('/api/order/:id', async (req, res) => res.json(await Order.findByIdAndUpdate(req.params.id, { status: req.body.status })));

app.get('/api/messages', async (req, res) => res.json(await Message.find().sort({ createdAt: 1 }).limit(50)));
app.post('/api/messages', async (req, res) => res.json(await new Message(req.body).save()));

app.get('/chef', (req, res) => res.sendFile(path.join(__dirname, './public/chef.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));

app.listen(PORT, () => console.log(`🚀 服务运行在: ${PORT}`));

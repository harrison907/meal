let dishData = [];
let cart = [];
let orders = [];
let messages = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => initApp());

async function initApp() {
    console.log("正在初始化餐厅...");
    try {
        await loadData();
        // 恢复本地购物车
        const savedCart = localStorage.getItem('kitchenCart');
        cart = savedCart ? JSON.parse(savedCart) : [];
        updateCartCount();

        // 如果是前厅，默认显示菜单；如果是后厨，自动加载
        if (document.getElementById('dish-list')) switchTab('menu');
        
        // 每3秒同步一次数据（聊天、订单、余额）
        if (!window.syncTimer) {
            window.syncTimer = setInterval(loadData, 3000);
        }
    } catch (e) { console.error("初始化失败:", e); }
}

// --- 核心：数据同步 ---
async function loadData() {
    try {
        const [resM, resO, resW, resMsg] = await Promise.all([
            fetch('/api/menu'), fetch('/api/orders'), fetch('/api/wallet'), fetch('/api/messages')
        ]);
        dishData = await resM.json();
        orders = await resO.json();
        const wallet = await resW.json();
        messages = await resMsg.json();

        // 更新余额显示
        const balEl = document.getElementById('user-balance');
        if (balEl) balEl.textContent = wallet.balance.toFixed(2);

        // 刷新当前可见的内容
        if (document.getElementById('kitchen-orders')) renderKitchen();
        if (document.getElementById('chat-messages')) renderChat();
        
        // 获取当前激活的标签页名
        const activeTab = document.querySelector('.nav-btn.active');
        if (activeTab) {
            const tabName = activeTab.getAttribute('onclick').match(/'([^']+)'/)[1];
            if (tabName === 'menu') renderDishes();
            if (tabName === 'orders') renderOrders();
            if (tabName === 'manage') renderManageList();
            if (tabName === 'cart') renderCart();
        }
    } catch (e) { console.warn("数据同步中..."); }
}

// --- 核心：切换标签页 (修复你目前的报错) ---
function switchTab(tab) {
    console.log("切换标签:", tab);
    const pages = document.querySelectorAll('.page');
    const btns = document.querySelectorAll('.nav-btn');
    
    pages.forEach(p => p.classList.remove('active'));
    btns.forEach(b => b.classList.remove('active'));

    const targetPage = document.getElementById(`${tab}-page`);
    const targetBtn = document.querySelector(`[onclick*="'${tab}'"]`);

    if (targetPage) targetPage.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    if (tab === 'menu') renderDishes();
    if (tab === 'cart') renderCart();
    if (tab === 'orders') renderOrders();
    if (tab === 'manage') renderManageList();
}

// --- 聊天功能 ---
async function sendMessage(sender) {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim()) return;
    await fetch('/api/messages', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sender, content: input.value })
    });
    input.value = '';
    loadData();
}

function renderChat() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = messages.map(m => `
        <div style="margin-bottom:8px; text-align: ${m.sender === 'chef' ? 'left' : 'right'};">
            <span style="background:${m.sender === 'chef' ? '#eee' : '#ff6b8b'}; color:${m.sender === 'chef' ? '#333' : '#fff'}; padding:5px 12px; border-radius:15px; display:inline-block; max-width:80%; font-size:14px;">
                ${m.content}
            </span>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

// --- 订单与购物车 ---
function addToCart(id) {
    const dish = dishData.find(d => d._id === id);
    if (!dish) return;
    const exist = cart.find(i => i._id === id);
    if (exist) exist.quantity++; else cart.push({...dish, quantity:1});
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
    updateCartCount();
    showNotification(`已加入 ${dish.name} 💰￥${dish.price}`);
}

function renderCart() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    if (!container) return;
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    if(totalEl) totalEl.textContent = total.toFixed(2);

    if (cart.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:40px;">还没选好吃的呢~</p>`;
        return;
    }
    container.innerHTML = cart.map(item => `
        <div class="cart-item" style="display:flex; justify-content:space-between; padding:15px; background:white; margin:10px; border-radius:10px;">
            <span>${item.emoji} ${item.name} x ${item.quantity} (￥${item.price})</span>
            <button onclick="removeFromCart('${item._id}')" style="color:red; background:none; border:none;">删除</button>
        </div>
    `).join('');
}

async function submitOrder() {
    if (cart.length === 0) return;
    const res = await fetch('/api/order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ items: cart })
    });
    const result = await res.json();
    if (!result.success) {
        alert("❌ " + result.message);
    } else {
        cart = [];
        localStorage.removeItem('kitchenCart');
        switchTab('orders');
        loadData();
        showNotification("支付并下单成功！🚀");
    }
}

// --- 其他功能 ---
function renderDishes() {
    const container = document.getElementById('dish-list');
    if (!container) return;
    container.innerHTML = dishData.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span>${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff4757; font-weight:bold;">￥${dish.price || 0}</div>
            <button class="btn-small" style="background:#ff6b8b; color:white; border:none; border-radius:10px; padding:4px 10px; margin-top:5px;">加入</button>
        </div>
    `).join('');
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;
    container.innerHTML = orders.map(order => `
        <div class="order-card" style="background:white; margin:10px; padding:15px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between;">
                <strong>单号 #${order._id.slice(-4)}</strong>
                <span class="status-${order.status}">${order.status}</span>
            </div>
            <div style="margin:10px 0; font-size:14px;">
                ${order.items.map(i => `<div>${i.name} x ${i.quantity} (￥${i.price})</div>`).join('')}
            </div>
            <div style="color:#666; font-size:12px;">支付金额: ￥${order.totalPrice.toFixed(2)}</div>
        </div>
    `).join('');
}

function renderKitchen() {
    const container = document.getElementById('kitchen-orders');
    if (!container) return;
    const waiting = orders.filter(o => o.status !== 'done');
    document.getElementById('waiting-count').textContent = waiting.length;
    document.getElementById('today-completed').textContent = orders.filter(o => o.status === 'done').length;

    container.innerHTML = waiting.map(order => `
        <div class="order-card" style="background:white; margin:10px; padding:15px; border-radius:10px; border-left:5px solid #ff6b8b;">
            <h3>单号 #${order._id.slice(-4)}</h3>
            ${order.items.map(i => `<div>${i.name} x ${i.quantity}</div>`).join('')}
            <button class="btn" style="background:#2ed573; color:white; width:100%; margin-top:10px;" 
                onclick="updateStatus('${order._id}', 'done')">完成制作</button>
        </div>
    `).join('');
}

async function updateStatus(id, status) {
    await fetch(`/api/order/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status }) });
    loadData();
}

function updateCartCount() {
    const el = document.getElementById('cart-count');
    if (el) el.textContent = cart.reduce((s, i) => s + i.quantity, 0);
}

function showNotification(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function removeFromCart(id) {
    cart = cart.filter(i => i._id !== id);
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

function renderManageList() {
    const container = document.getElementById('manage-dish-list');
    if (!container) return;
    container.innerHTML = dishData.map(d => `
        <div style="display:flex; justify-content:space-between; padding:10px; background:white; margin:5px; border-radius:8px;">
            <span>${d.name} (￥${d.price})</span>
            <button onclick="deleteDish('${d._id}')" style="color:red; background:none; border:none;">删除</button>
        </div>
    `).join('');
}

async function deleteDish(id) {
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    loadData();
}

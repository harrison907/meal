let dishData = [];
let cart = [];
let orders = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => initApp());

async function initApp() {
    try {
        await loadDishesFromServer();
        cart = JSON.parse(localStorage.getItem('kitchenCart') || '[]');
        
        // 容错检查：只有元素存在才加载
        if (document.getElementById('orders-list')) await loadOrders();
        if (document.getElementById('kitchen-orders')) await loadKitchen();
        
        updateCartCount();
        console.log("应用初始化完成");
    } catch (error) {
        console.error("初始化失败:", error);
    }
}

// 核心：切换标签页 (修复可能导致点击失效的问题)
function switchTab(tab) {
    console.log("切换到:", tab);
    // 1. 隐藏所有页面，取消所有按钮激活
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // 2. 显示目标页面
    const targetPage = document.getElementById(`${tab}-page`);
    if (targetPage) targetPage.classList.add('active');

    // 3. 激活对应按钮
    // 兼容处理：尝试根据 onclick 属性寻找按钮
    const btn = document.querySelector(`.nav-btn[onclick*="${tab}"]`);
    if (btn) btn.classList.add('active');

    // 4. 刷新数据
    if (tab === 'menu') renderDishes(dishData);
    if (tab === 'manage') renderManageList();
    if (tab === 'orders') loadOrders();
}

async function loadDishesFromServer() {
    try {
        const res = await fetch('/api/menu');
        dishData = await res.json();
        const oRes = await fetch('/api/orders');
        orders = await oRes.json();
        renderDishes(dishData);
    } catch (e) {
        console.error("加载菜单失败", e);
    }
}

function getDishAvgRating(dishName) {
    const rated = orders.filter(o => o.rating > 0 && o.items.some(i => i.name === dishName));
    if (rated.length === 0) return "⭐⭐⭐⭐⭐";
    const avg = rated.reduce((s, o) => s + o.rating, 0) / rated.length;
    return `⭐ ${avg.toFixed(1)}`;
}

function renderDishes(data) {
    const container = document.getElementById('dish-list');
    if (!container) return;
    if (data.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding:20px;">菜单空空如也，去管理页面加点菜吧~</p>';
        return;
    }
    container.innerHTML = data.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span style="font-size:48px;">${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff9f43; font-size:12px; margin:4px 0;">${getDishAvgRating(dish.name)}</div>
            <div class="dish-time">⏰ ${dish.time}min</div>
            <button class="btn" style="background:#ff6b8b; color:white; margin-top:8px; border:none; border-radius:15px; padding:5px 15px;">加入</button>
        </div>
    `).join('');
}

function addToCart(id) {
    const dish = dishData.find(d => d._id === id);
    if (!dish) return;
    const exist = cart.find(i => i._id === id);
    if (exist) exist.quantity++; else cart.push({ ...dish, quantity: 1 });
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
    updateCartCount();
    showNotification(`已添加 ${dish.name}`);
}

function updateCartCount() {
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    const el = document.getElementById('cart-count');
    if (el) el.textContent = count;
}

function showNotification(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

// 评价功能
async function rateOrder(id, score) {
    await fetch(`/api/order/${id}/rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: score })
    });
    showNotification("评价成功！❤️");
    await initApp();
}

async function loadOrders() {
    const res = await fetch('/api/orders');
    orders = await res.json();
    const container = document.getElementById('orders-list');
    if (!container) return;
    container.innerHTML = orders.map(order => `
        <div class="order-card" style="background:white; margin:10px; padding:15px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between;">
                <strong>订单 #${order._id.slice(-4)}</strong>
                <span class="status-${order.status}" style="font-size:12px; padding:2px 8px; border-radius:10px;">${order.status}</span>
            </div>
            <div style="margin:10px 0; font-size:14px;">
                ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
            </div>
            ${order.status === 'done' && order.rating === 0 ? `
                <div style="border-top:1px dashed #eee; padding-top:10px; margin-top:10px;">
                    <p style="font-size:12px; color:#666;">评价一下：</p>
                    ${[1, 2, 3, 4, 5].map(n => `<button onclick="rateOrder('${order._id}', ${n})" style="border:1px solid #ff6b8b; background:none; color:#ff6b8b; margin-right:5px; border-radius:4px; padding:2px 8px;">${n}⭐</button>`).join('')}
                </div>
            ` : order.rating > 0 ? `<div style="color:#ff9f43; font-size:13px;">我的评分: ${order.rating} ⭐</div>` : ''}
        </div>
    `).join('');
}

// 管理功能
async function addDish() {
    const name = document.getElementById('new-dish-name').value;
    const emoji = document.getElementById('new-dish-emoji').value;
    const time = document.getElementById('new-dish-time').value;
    if (!name || !emoji) return showNotification("请输入完整内容");
    await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji, time: parseInt(time) || 10, category: "lunch" })
    });
    showNotification("上架成功");
    document.getElementById('new-dish-name').value = '';
    await loadDishesFromServer();
    renderManageList();
}

function renderManageList() {
    const container = document.getElementById('manage-dish-list');
    if (!container) return;
    container.innerHTML = dishData.map(d => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:white; border-radius:8px; margin-bottom:8px;">
            <span>${d.emoji} ${d.name}</span>
            <button onclick="deleteDish('${d._id}')" style="color:#ff4757; border:none; background:none;">删除</button>
        </div>
    `).join('');
}

async function deleteDish(id) {
    if (!confirm("确定要下架这道菜吗？")) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    await loadDishesFromServer();
    renderManageList();
}

async function submitOrder() {
    if (cart.length === 0) return showNotification("请先选菜");
    await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart })
    });
    cart = [];
    localStorage.removeItem('kitchenCart');
    updateCartCount();
    switchTab('orders');
    showNotification("订单已发送给大厨！🚀");
}

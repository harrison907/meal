let dishData = [];
let cart = [];
let orders = [];

// 初始化应用
document.addEventListener('DOMContentLoaded', () => initApp());

async function initApp() {
    try {
        console.log("正在初始化数据...");
        await loadDishesFromServer();
        // 从本地读取购物车
        const savedCart = localStorage.getItem('kitchenCart');
        cart = savedCart ? JSON.parse(savedCart) : [];
        
        // 渲染当前页
        const activeTab = document.querySelector('.nav-btn.active');
        if (activeTab) {
            const tabName = activeTab.getAttribute('onclick').match(/'([^']+)'/)[1];
            switchTab(tabName);
        } else {
            switchTab('menu');
        }
        
        updateCartCount();
    } catch (error) {
        console.error("初始化失败:", error);
    }
}

// --- 核心：切换标签页 ---
function switchTab(tab) {
    console.log("切换到标签:", tab);
    
    // 1. 切换页面显示
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`${tab}-page`);
    if (targetPage) targetPage.classList.add('active');

    // 2. 切换导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[onclick*="'${tab}'"]`);
    if (btn) btn.classList.add('active');

    // 3. 根据标签加载对应内容
    if (tab === 'menu') renderDishes(dishData);
    if (tab === 'cart') renderCart(); // 修复点：增加购物车渲染
    if (tab === 'manage') renderManageList();
    if (tab === 'orders') loadOrders();
}

// --- 1. 菜单功能 ---
async function loadDishesFromServer() {
    const res = await fetch('/api/menu');
    dishData = await res.json();
    const oRes = await fetch('/api/orders');
    orders = await oRes.json();
    renderDishes(dishData);
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
    container.innerHTML = data.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span style="font-size:48px;">${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff9f43; font-size:12px; margin:5px 0;">${getDishAvgRating(dish.name)}</div>
            <div class="dish-time">⏰ ${dish.time}min</div>
            <button class="btn" style="background:#ff6b8b; color:white; margin-top:5px; border:none; border-radius:15px; padding:5px 15px;">加入清单</button>
        </div>
    `).join('');
}

// --- 2. 购物车（清单）功能 - 修复重点 ---
function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:50px 20px;">
                <div style="font-size:50px;">🛒</div>
                <p style="color:#999; margin-top:10px;">清单还是空的，快去选菜吧~</p>
            </div>
        `;
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item" style="display:flex; justify-content:space-between; align-items:center; background:white; margin:10px; padding:15px; border-radius:12px;">
            <div style="display:flex; align-items:center;">
                <span style="font-size:30px; margin-right:15px;">${item.emoji}</span>
                <div>
                    <div style="font-weight:bold;">${item.name}</div>
                    <div style="font-size:12px; color:#999;">数量: ${item.quantity}</div>
                </div>
            </div>
            <button onclick="removeFromCart('${item._id}')" style="color:#ff4757; background:none; border:none;">删除</button>
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
    showNotification(`已添加 ${dish.name} ❤️`);
}

function removeFromCart(id) {
    cart = cart.filter(i => i._id !== id);
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

async function submitOrder() {
    if (cart.length === 0) return showNotification("清单是空的哦");
    await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart })
    });
    cart = [];
    localStorage.removeItem('kitchenCart');
    updateCartCount();
    switchTab('orders');
    showNotification("订单已发送给TA！🚀");
}

// --- 3. 订单与评价 ---
async function rateOrder(id, score) {
    await fetch(`/api/order/${id}/rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: score })
    });
    showNotification("评价成功！❤️");
    // 延迟一下再刷新，让用户看清通知
    setTimeout(() => initApp(), 500);
}

async function loadOrders() {
    const res = await fetch('/api/orders');
    orders = await res.json();
    const container = document.getElementById('orders-list');
    if (!container) return;
    
    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">还没有订单记录</p>';
        return;
    }

    container.innerHTML = orders.map(order => `
        <div class="order-card" style="background:white; margin:10px; padding:15px; border-radius:12px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <strong style="color:#ff6b8b;">订单 #${order._id.slice(-4)}</strong>
                <span class="status-${order.status}" style="font-size:12px; padding:2px 8px; border-radius:10px; background:#f0f0f0;">${order.status}</span>
            </div>
            <div style="font-size:14px; margin-bottom:10px;">
                ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
            </div>
            ${order.status === 'done' && order.rating === 0 ? `
                <div style="border-top:1px dashed #eee; padding-top:10px; margin-top:10px;">
                    <p style="font-size:12px; color:#666; margin-bottom:8px;">给大厨打分：</p>
                    <div style="display:flex; gap:8px;">
                        ${[1, 2, 3, 4, 5].map(n => `<button onclick="rateOrder('${order._id}', ${n})" style="border:1px solid #ff6b8b; background:none; color:#ff6b8b; border-radius:5px; padding:3px 10px;">${n}⭐</button>`).join('')}
                    </div>
                </div>
            ` : order.rating > 0 ? `<div style="color:#ff9f43; font-size:13px; font-weight:bold;">评分: ${order.rating} ⭐</div>` : ''}
        </div>
    `).join('');
}

// --- 4. 管理与工具 ---
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
    setTimeout(() => t.classList.remove('show'), 2500);
}

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
    showNotification("上架成功 ✨");
    document.getElementById('new-dish-name').value = '';
    document.getElementById('new-dish-emoji').value = '';
    await loadDishesFromServer();
    renderManageList();
}

function renderManageList() {
    const container = document.getElementById('manage-dish-list');
    if (!container) return;
    container.innerHTML = dishData.map(d => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:white; border-radius:10px; margin:10px; box-shadow:0 2px 5px rgba(0,0,0,0.03);">
            <span>${d.emoji} ${d.name}</span>
            <button onclick="deleteDish('${d._id}')" style="color:#ff4757; border:none; background:none; font-size:14px;">下架</button>
        </div>
    `).join('');
}

async function deleteDish(id) {
    if (!confirm("确定要下架这道菜吗？")) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    await loadDishesFromServer();
    renderManageList();
}

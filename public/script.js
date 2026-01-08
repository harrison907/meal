let dishData = [];
let cart = [];
let orders = [];

document.addEventListener('DOMContentLoaded', () => initApp());

async function initApp() {
    try {
        await loadData();
        cart = JSON.parse(localStorage.getItem('kitchenCart') || '[]');
        updateCartCount();
        
        // 如果是在后厨页面，每10秒刷新一次数据
        if (document.getElementById('kitchen-orders')) {
            setInterval(loadData, 10000);
        }
    } catch (e) { console.error("初始化失败:", e); }
}

async function loadData() {
    try {
        const resM = await fetch('/api/menu');
        dishData = await resM.json();
        const resO = await fetch('/api/orders');
        orders = await resO.json();

        // 渲染当前存在的元素
        if (document.getElementById('dish-list')) renderDishes();
        if (document.getElementById('orders-list')) renderOrders();
        if (document.getElementById('kitchen-orders')) renderKitchen();
        if (document.getElementById('manage-dish-list')) renderManageList();
        if (document.getElementById('cart-items')) renderCart();
    } catch (e) { console.warn("同步失败", e); }
}

function getDishAvgRating(name) {
    const rated = orders.filter(o => o.rating > 0 && o.items.some(i => i.name === name));
    if (rated.length === 0) return "⭐⭐⭐⭐⭐";
    const avg = rated.reduce((s, o) => s + o.rating, 0) / rated.length;
    return `⭐ ${avg.toFixed(1)}`;
}

// 标签切换 (增加防护，解决报错)
function switchTab(tab) {
    const pages = document.querySelectorAll('.page');
    const btns = document.querySelectorAll('.nav-btn');
    
    pages.forEach(p => p.classList.remove('active'));
    btns.forEach(b => b.classList.remove('active'));

    const targetPage = document.getElementById(`${tab}-page`);
    const targetBtn = document.querySelector(`[onclick*="'${tab}'"]`);

    // 关键修复：只有当元素存在时才操作 classList
    if (targetPage) targetPage.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    if (tab === 'menu') renderDishes();
    if (tab === 'cart') renderCart();
    if (tab === 'orders') renderOrders();
    if (tab === 'manage') renderManageList();
}

// 渲染菜单
function renderDishes() {
    const container = document.getElementById('dish-list');
    if (!container) return;
    container.innerHTML = dishData.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span>${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff9f43; font-size:12px;">${getDishAvgRating(dish.name)}</div>
            <div class="dish-time">⏰ ${dish.time}min</div>
            <button class="btn" style="background:#ff6b8b; color:white; margin-top:8px;">加入清单</button>
        </div>
    `).join('');
}

// 渲染购物车 (清单)
function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:40px; color:#999;">清单空空如也~</p>`;
        return;
    }
    container.innerHTML = cart.map(item => `
        <div class="cart-item" style="display:flex; justify-content:space-between; padding:15px; background:white; margin:10px; border-radius:10px;">
            <span>${item.emoji} ${item.name} x ${item.quantity}</span>
            <button onclick="removeFromCart('${item._id}')" style="color:red; background:none; border:none;">删除</button>
        </div>
    `).join('');
}

// 后厨逻辑
function renderKitchen() {
    const container = document.getElementById('kitchen-orders');
    if (!container) return;
    const waiting = orders.filter(o => o.status !== 'done');
    
    document.getElementById('waiting-count').textContent = waiting.length;
    document.getElementById('today-completed').textContent = orders.filter(o => o.status === 'done').length;

    container.innerHTML = waiting.map(order => `
        <div class="order-card" style="border-left:5px solid #ff6b8b; margin:10px; background:white; padding:15px; border-radius:10px;">
            <div style="display:flex; justify-content:space-between;">
                <strong>订单 #${order._id.slice(-4)}</strong>
                <span class="status-${order.status}">${order.status}</span>
            </div>
            <div style="margin:10px 0;">
                ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity} <small style="color:#ff9f43;">(${getDishAvgRating(i.name)})</small></div>`).join('')}
            </div>
            <button class="btn" style="background:${order.status==='waiting'?'#1e90ff':'#2ed573'}; color:white;" 
                onclick="updateStatus('${order._id}', '${order.status==='waiting'?'cooking':'done'}')">
                ${order.status === 'waiting' ? '开始制作' : '制作完成'}
            </button>
        </div>
    `).join('');
}

// 管理员增加菜品
async function addDish() {
    const name = document.getElementById('new-dish-name').value;
    const emoji = document.getElementById('new-dish-emoji').value;
    const time = document.getElementById('new-dish-time').value;
    if(!name || !emoji) return showNotification("请输入完整内容");

    await fetch('/api/menu', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, emoji, time: parseInt(time) || 10 })
    });
    showNotification("上架成功 ✨");
    document.getElementById('new-dish-name').value = '';
    await loadData();
    renderManageList();
}

// 订单渲染与评分按钮
async function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;
    container.innerHTML = orders.map(order => `
        <div class="order-card" style="background:white; margin:10px; padding:15px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between;">
                <strong>订单 #${order._id.slice(-4)}</strong>
                <span class="status-${order.status}">${order.status}</span>
            </div>
            <div style="margin:10px 0;">${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}</div>
            ${order.status === 'done' && order.rating === 0 ? `
                <div style="border-top:1px dashed #eee; padding-top:10px; margin-top:10px;">
                    打分：${[1,2,3,4,5].map(n => `<button onclick="rateOrder('${order._id}', ${n})" style="border:1px solid #ff6b8b; background:none; color:#ff6b8b; margin-right:5px; border-radius:4px; padding:2px 8px;">${n}⭐</button>`).join('')}
                </div>
            ` : order.rating > 0 ? `<div style="color:#ff9f43;">评分: ${order.rating} ⭐</div>` : ''}
        </div>
    `).join('');
}

// --- 通用/底层功能 ---
async function updateStatus(id, status) {
    await fetch(`/api/order/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status }) });
    loadData();
}

async function rateOrder(id, score) {
    await fetch(`/api/order/${id}/rate`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ rating: score }) });
    showNotification("感谢评价！❤️");
    loadData();
}

function addToCart(id) {
    const dish = dishData.find(d => d._id === id);
    if (!dish) return;
    const exist = cart.find(i => i._id === id);
    if (exist) exist.quantity++; else cart.push({...dish, quantity:1});
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
    if(cart.length === 0) return showNotification("清单是空的");
    await fetch('/api/order', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ items: cart }) });
    cart = []; localStorage.removeItem('kitchenCart'); updateCartCount(); switchTab('orders');
    showNotification("已发送！🚀");
}

function updateCartCount() {
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    const el = document.getElementById('cart-count');
    if (el) el.textContent = count;
}

function showNotification(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function renderManageList() {
    const container = document.getElementById('manage-dish-list');
    if (!container) return;
    container.innerHTML = dishData.map(d => `<div style="display:flex; justify-content:space-between; background:white; padding:10px; border-radius:8px; margin-bottom:5px;"><span>${d.emoji} ${d.name}</span><button onclick="deleteDish('${d._id}')" style="color:red; background:none; border:none;">删除</button></div>`).join('');
}

async function deleteDish(id) {
    if(!confirm("确定删除？")) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    loadData();
}

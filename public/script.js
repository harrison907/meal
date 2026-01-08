// 全局状态
let dishData = [];
let cart = [];
let orders = [];

// 【关键：启动指令】
document.addEventListener('DOMContentLoaded', () => initApp());

async function initApp() {
    console.log("正在初始化应用...");
    try {
        await loadData();
        cart = JSON.parse(localStorage.getItem('kitchenCart') || '[]');
        updateCartCount();
        
        // 自动轮询订单数据
        setInterval(loadData, 10000);
    } catch (e) {
        console.error("初始化出错:", e);
    }
}

async function loadData() {
    try {
        const resM = await fetch('/api/menu');
        dishData = await resM.json();
        const resO = await fetch('/api/orders');
        orders = await resO.json();

        // 渲染
        if (document.getElementById('dish-list')) renderDishes();
        if (document.getElementById('orders-list')) renderOrders();
        if (document.getElementById('manage-dish-list')) renderManageList();
        if (document.getElementById('kitchen-orders')) renderKitchen();
        
    } catch (e) {
        console.warn("数据同步失败:", e);
    }
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
            <button class="btn" style="background:#ff6b8b; color:white; margin-top:10px;">加入清单</button>
        </div>
    `).join('');
}

function getDishAvgRating(dishName) {
    const rated = orders.filter(o => o.rating > 0 && o.items.some(i => i.name === dishName));
    if (rated.length === 0) return "⭐⭐⭐⭐⭐";
    const avg = rated.reduce((s, o) => s + o.rating, 0) / rated.length;
    return `⭐ ${avg.toFixed(1)}`;
}

// 购物车逻辑
function addToCart(id) {
    const dish = dishData.find(d => d._id === id);
    if (!dish) return;
    const exist = cart.find(i => i._id === id);
    if (exist) exist.quantity++; else cart.push({...dish, quantity:1});
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
    updateCartCount();
    showNotification(`已添加 ${dish.name} ❤️`);
}

function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:40px;">清单空空如也~</p>`;
        return;
    }
    container.innerHTML = cart.map(item => `
        <div class="cart-item" style="display:flex; justify-content:space-between; padding:15px; background:white; margin:10px; border-radius:10px;">
            <span>${item.emoji} ${item.name} x ${item.quantity}</span>
            <button onclick="removeFromCart('${item._id}')" style="color:red; background:none; border:none;">删除</button>
        </div>
    `).join('');
}

function removeFromCart(id) {
    cart = cart.filter(i => i._id !== id);
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
}

async function submitOrder() {
    if(cart.length === 0) return showNotification("没选菜怎么下单呀~");
    await fetch('/api/order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ items: cart })
    });
    cart = [];
    localStorage.removeItem('kitchenCart');
    updateCartCount();
    switchTab('orders');
    showNotification("下单成功！TA收到通知啦🚀");
}

// 渲染订单
async function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;
    container.innerHTML = orders.map(order => `
        <div class="order-card">
            <h3>订单 #${order._id.slice(-4)} [${order.status}]</h3>
            ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
            ${order.status === 'done' && order.rating === 0 ? `
                <div style="margin-top:10px;">
                    打个分：${[1,2,3,4,5].map(n => `<button class="btn-small" onclick="rateOrder('${order._id}', ${n})">${n}⭐</button>`).join(' ')}
                </div>
            ` : order.rating > 0 ? `<div style="color:#ff9f43;">评分: ${order.rating} ⭐</div>` : ''}
        </div>
    `).join('');
}

async function rateOrder(id, score) {
    await fetch(`/api/order/${id}/rate`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ rating: score })
    });
    showNotification("评价成功！❤️");
    loadData();
}

// 后厨逻辑
function renderKitchen() {
    const container = document.getElementById('kitchen-orders');
    if (!container) return;
    const waiting = orders.filter(o => o.status !== 'done');
    document.getElementById('waiting-count').textContent = waiting.length;
    document.getElementById('today-completed').textContent = orders.filter(o => o.status === 'done').length;
    container.innerHTML = waiting.map(order => `
        <div class="order-card">
            <h3>单号 #${order._id.slice(-4)}</h3>
            ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
            <div style="margin-top:10px;">
                ${order.status === 'waiting' ? 
                    `<button class="btn" style="background:#1e90ff; color:white;" onclick="updateStatus('${order._id}', 'cooking')">开始制作</button>` :
                    `<button class="btn" style="background:#2ed573; color:white;" onclick="updateStatus('${order._id}', 'done')">完成制作</button>`
                }
            </div>
        </div>
    `).join('');
}

async function updateStatus(id, status) {
    await fetch(`/api/order/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ status })
    });
    loadData();
}

// 管理菜单逻辑 (解决 addDish 未定义问题)
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

function renderManageList() {
    const container = document.getElementById('manage-dish-list');
    if (!container) return;
    container.innerHTML = dishData.map(d => `
        <div style="display:flex; justify-content:space-between; background:white; padding:10px; border-radius:8px; margin-bottom:5px;">
            <span>${d.emoji} ${d.name}</span>
            <button onclick="deleteDish('${d._id}')" style="color:red; background:none; border:none;">删除</button>
        </div>
    `).join('');
}

async function deleteDish(id) {
    if(!confirm("确定要下架这道菜吗？")) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    await loadData();
    renderManageList();
}

// 辅助功能
function switchTab(tab) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`${tab}-page`).classList.add('active');
    document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
    if (tab === 'menu') renderDishes();
    if (tab === 'cart') renderCart();
    if (tab === 'orders') renderOrders();
    if (tab === 'manage') renderManageList();
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

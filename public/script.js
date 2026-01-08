let dishData = [];
let cart = [];
let orders = [];
let currentTab = 'menu';

document.addEventListener('DOMContentLoaded', () => initApp());

async function initApp() {
    await loadDishesFromServer();
    cart = JSON.parse(localStorage.getItem('kitchenCart') || '[]');
    await loadOrders();
    updateCartCount();
}

async function loadDishesFromServer() {
    const res = await fetch('/api/menu');
    dishData = await res.json();
    renderDishes(dishData);
}

function renderDishes(data) {
    const container = document.getElementById('dish-list');
    if(!container) return;
    container.innerHTML = data.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span style="font-size: 48px;">${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div class="dish-time">⏰ ${dish.time}分钟</div>
            <button class="btn" style="background: #ff6b8b; color: white; margin-top: 10px;">加入清单</button>
        </div>
    `).join('');
}

async function addDish() {
    const name = document.getElementById('new-dish-name').value;
    const emoji = document.getElementById('new-dish-emoji').value;
    const category = document.getElementById('new-dish-cat').value;
    const time = document.getElementById('new-dish-time').value;
    if(!name || !emoji) return showNotification("请填写完整");

    await fetch('/api/menu', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, emoji, category, time: parseInt(time) })
    });
    document.getElementById('new-dish-name').value = '';
    showNotification("添加成功！");
    await loadDishesFromServer();
    renderManageList();
}

async function deleteDish(id) {
    if(!confirm("确定删除吗？")) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    await loadDishesFromServer();
    renderManageList();
}

function renderManageList() {
    const container = document.getElementById('manage-dish-list');
    container.innerHTML = dishData.map(dish => `
        <div class="cart-item" style="background:white; padding:10px; border-radius:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
            <span>${dish.emoji} ${dish.name}</span>
            <button onclick="deleteDish('${dish._id}')" style="color:red; background:none; border:none; cursor:pointer;">删除</button>
        </div>
    `).join('');
}

async function submitOrder() {
    if (cart.length === 0) return showNotification("购物车是空的");
    await fetch('/api/order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ items: cart })
    });
    cart = [];
    localStorage.removeItem('kitchenCart');
    updateCartCount();
    switchTab('orders');
    showNotification("订单已发送！🚀");
}

async function loadOrders() {
    const res = await fetch('/api/orders');
    orders = await res.json();
    const container = document.getElementById('orders-list');
    if(!container) return;
    container.innerHTML = orders.map(order => `
        <div class="order-card">
            <div style="display:flex; justify-content:space-between;">
                <h3>订单 #${order._id.slice(-4)}</h3>
                <span class="status-${order.status}">${order.status}</span>
            </div>
            <div style="margin:10px 0;">${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}</div>
        </div>
    `).join('');
}

async function updateOrderStatus(id, status) {
    await fetch(`/api/order/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ status })
    });
    loadKitchen();
}

async function loadKitchen() {
    const res = await fetch('/api/orders');
    const all = await res.json();
    const waiting = all.filter(o => o.status !== 'done');
    document.getElementById('waiting-count').textContent = waiting.length;
    document.getElementById('today-completed').textContent = all.filter(o => o.status === 'done').length;
    const container = document.getElementById('kitchen-orders');
    container.innerHTML = waiting.map(order => `
        <div class="order-card">
            <h3>订单 #${order._id.slice(-4)}</h3>
            ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
            <div style="margin-top:10px;">
                ${order.status === 'waiting' ? 
                    `<button class="btn" style="background:#1e90ff;color:white;" onclick="updateOrderStatus('${order._id}', 'cooking')">开始制作</button>` :
                    `<button class="btn" style="background:#2ed573;color:white;" onclick="updateOrderStatus('${order._id}', 'done')">制作完成</button>`
                }
            </div>
        </div>
    `).join('');
}

function addToCart(dishId) {
    const dish = dishData.find(d => d._id === dishId);
    const existing = cart.find(i => i._id === dishId);
    if (existing) { existing.quantity++; } 
    else { cart.push({ ...dish, quantity: 1 }); }
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
    updateCartCount();
    showNotification(`已添加 ${dish.name}`);
}

function switchTab(tab) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`[onclick="switchTab('${tab}')"]`);
    if(btn) btn.classList.add('active');
    document.getElementById(`${tab}-page`).classList.add('active');
    if (tab === 'menu') renderDishes(dishData);
    if (tab === 'orders') loadOrders();
    if (tab === 'kitchen') loadKitchen();
    if (tab === 'manage') renderManageList();
}

function updateCartCount() {
    document.getElementById('cart-count').textContent = cart.reduce((s, i) => s + i.quantity, 0);
}

function showNotification(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function filterDishes(cat) {
    const filtered = cat === 'all' ? dishData : dishData.filter(d => d.category === cat);
    renderDishes(filtered);
}

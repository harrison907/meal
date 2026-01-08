let dishData = [];
let cart = [];
let orders = [];

document.addEventListener('DOMContentLoaded', () => initApp());

async function initApp() {
    await loadDishesFromServer();
    cart = JSON.parse(localStorage.getItem('kitchenCart') || '[]');
    // 根据页面元素判断加载哪部分
    if (document.getElementById('orders-list')) await loadOrders();
    if (document.getElementById('kitchen-orders')) await loadKitchen();
    updateCartCount();
}

// 计算某道菜的平均分
function getDishAvgRating(dishName) {
    const ratedOrders = orders.filter(o => 
        o.rating > 0 && o.items.some(i => i.name === dishName)
    );
    if (ratedOrders.length === 0) return "新菜上线";
    const sum = ratedOrders.reduce((s, o) => s + o.rating, 0);
    return `⭐ ${(sum / ratedOrders.length).toFixed(1)}`;
}

async function loadDishesFromServer() {
    const res = await fetch('/api/menu');
    dishData = await res.json();
    // 还要加载一下订单，因为平均分是算出来的
    const oRes = await fetch('/api/orders');
    orders = await oRes.json();
    renderDishes(dishData);
}

function renderDishes(data) {
    const container = document.getElementById('dish-list');
    if(!container) return;
    container.innerHTML = data.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span style="font-size:48px;">${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff9f43; font-size:13px; margin:5px 0;">${getDishAvgRating(dish.name)}</div>
            <div class="dish-time">⏰ ${dish.time}min</div>
            <button class="btn" style="background:#ff6b8b; color:white; margin-top:5px;">加入清单</button>
        </div>
    `).join('');
}

// 前厅评价功能
async function rateOrder(id, score) {
    await fetch(`/api/order/${id}/rate`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ rating: score })
    });
    alert("评价成功！");
    await initApp();
}

async function loadOrders() {
    const res = await fetch('/api/orders');
    orders = await res.json();
    const container = document.getElementById('orders-list');
    if(!container) return;
    container.innerHTML = orders.map(order => `
        <div class="order-card">
            <h3>订单 #${order._id.slice(-4)} [${order.status}]</h3>
            ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
            ${order.status === 'done' && order.rating === 0 ? `
                <div style="margin-top:10px; border-top:1px dashed #ccc; padding-top:10px;">
                    打分：${[1,2,3,4,5].map(n => `<button class="btn-small" onclick="rateOrder('${order._id}', ${n})">${n}⭐</button>`).join(' ')}
                </div>
            ` : order.rating > 0 ? `<div style="color:#ff9f43; margin-top:10px;">评分: ${order.rating} ⭐</div>` : ''}
        </div>
    `).join('');
}

// 后厨功能
async function loadKitchen() {
    const res = await fetch('/api/orders');
    const all = await res.json();
    const waiting = all.filter(o => o.status !== 'done');
    document.getElementById('waiting-count').textContent = waiting.length;
    document.getElementById('today-completed').textContent = all.filter(o => o.status === 'done').length;
    
    const container = document.getElementById('kitchen-orders');
    if(!container) return;
    container.innerHTML = waiting.map(order => `
        <div class="order-card">
            <h3>订单 #${order._id.slice(-4)}</h3>
            ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
            <div style="margin-top:10px;">
                ${order.status === 'waiting' ? 
                    `<button class="btn" style="background:#1e90ff;color:white;" onclick="updateStatus('${order._id}', 'cooking')">开始制作</button>` :
                    `<button class="btn" style="background:#2ed573;color:white;" onclick="updateStatus('${order._id}', 'done')">完成制作</button>`
                }
            </div>
            ${order.rating > 0 ? `<div style="color:red;">评价：${order.rating}⭐</div>` : ''}
        </div>
    `).join('');
}

async function updateStatus(id, status) {
    await fetch(`/api/order/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ status })
    });
    loadKitchen();
}

// 基础功能
function addToCart(id) {
    const dish = dishData.find(d => d._id === id);
    const exist = cart.find(i => i._id === id);
    if(exist) exist.quantity++; else cart.push({...dish, quantity:1});
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    const el = document.getElementById('cart-count');
    if(el) el.textContent = count;
}

// 管理功能
async function addDish() {
    const name = document.getElementById('new-dish-name').value;
    const emoji = document.getElementById('new-dish-emoji').value;
    const time = document.getElementById('new-dish-time').value;
    await fetch('/api/menu', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, emoji, time: parseInt(time), category: "lunch" })
    });
    alert("添加成功");
    loadDishesFromServer();
    renderManageList();
}

async function deleteDish(id) {
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    loadDishesFromServer();
    renderManageList();
}

function renderManageList() {
    const container = document.getElementById('manage-dish-list');
    if(!container) return;
    container.innerHTML = dishData.map(d => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; background:white; padding:10px; border-radius:5px;">
            <span>${d.emoji} ${d.name}</span>
            <button onclick="deleteDish('${d._id}')" style="color:red; background:none; border:none;">删除</button>
        </div>
    `).join('');
}

function switchTab(tab) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const b = document.querySelector(`[onclick="switchTab('${tab}')"]`);
    if(b) b.classList.add('active');
    document.getElementById(`${tab}-page`).classList.add('active');
    if(tab==='manage') renderManageList();
    if(tab==='orders') loadOrders();
}

async function submitOrder() {
    if(cart.length===0) return;
    await fetch('/api/order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ items: cart })
    });
    cart = [];
    localStorage.removeItem('kitchenCart');
    updateCartCount();
    switchTab('orders');
}

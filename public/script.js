// 全局状态
let dishData = []; // 从服务器获取
let cart = [];
let orders = [];
let currentTab = 'menu';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    await loadDishesFromServer(); // 先拿菜单
    loadCartFromLocal();        // 购物车可以留在本地
    await loadOrders();         // 拿订单
    updateCartCount();
    showNotification("数据同步成功！❤️");
}

// 切换标签
function switchTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    
    const targetBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if(targetBtn) targetBtn.classList.add('active');
    document.getElementById(`${tabName}-page`).classList.add('active');
    
    currentTab = tabName;
    if (tabName === 'menu') renderDishes(dishData);
    if (tabName === 'orders') loadOrders();
    if (tabName === 'kitchen') loadKitchen();
    if (tabName === 'manage') renderManageList();
}

// --- API 操作 ---

async function loadDishesFromServer() {
    const res = await fetch('/api/menu');
    dishData = await res.json();
    renderDishes(dishData);
}

function renderDishes(data) {
    const container = document.getElementById('dish-list');
    if(!container) return;
    container.innerHTML = data.map(dish => `
        <div class="dish-card" onclick="addToCart(${dish.id})">
            <div class="dish-image"><span style="font-size: 48px;">${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div class="dish-time">⏰ ${dish.time}分钟</div>
            <button class="btn" style="background: #ff6b8b; color: white; margin-top: 10px;">加入清单</button>
        </div>
    `).join('');
}

// 添加新菜品
async function addDish() {
    const name = document.getElementById('new-dish-name').value;
    const emoji = document.getElementById('new-dish-emoji').value;
    const category = document.getElementById('new-dish-cat').value;
    const time = document.getElementById('new-dish-time').value;

    if(!name || !emoji) return showNotification("请填写完整信息");

    await fetch('/api/menu', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, emoji, category, time, difficulty: "★★★☆☆" })
    });

    showNotification("添加成功！");
    await loadDishesFromServer();
    renderManageList();
}

// 删除菜品
async function deleteDish(id) {
    if(!confirm("确定要删除这道菜吗？")) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    await loadDishesFromServer();
    renderManageList();
    showNotification("已删除");
}

// 渲染管理列表
function renderManageList() {
    const container = document.getElementById('manage-dish-list');
    container.innerHTML = dishData.map(dish => `
        <div class="cart-item" style="background:white; padding:10px; border-radius:10px; margin-bottom:5px; display:flex; justify-content:space-between;">
            <span>${dish.emoji} ${dish.name}</span>
            <button onclick="deleteDish(${dish.id})" style="color:red; background:none; border:none;">删除</button>
        </div>
    `).join('');
}

// --- 订单逻辑 (改用服务器同步) ---

async function submitOrder() {
    if (cart.length === 0) return showNotification("购物车是空的");
    
    const orderData = {
        items: cart,
        totalTime: cart.reduce((s, i) => s + (i.time * i.quantity), 0)
    };

    const res = await fetch('/api/order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(orderData)
    });

    if(res.ok) {
        cart = [];
        saveCartToLocal();
        updateCartCount();
        switchTab('orders');
        showNotification("订单已发送给TA！🚀");
    }
}

async function loadOrders() {
    const res = await fetch('/api/orders');
    orders = await res.json();
    const container = document.getElementById('orders-list');
    if(!container) return;
    
    if (orders.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px;">暂无订单</p>`;
        return;
    }

    container.innerHTML = orders.slice().reverse().map(order => `
        <div class="order-card">
            <div style="display:flex; justify-content:space-between;">
                <h3>订单 #${order.id.toString().slice(-4)}</h3>
                <span class="status-${order.status}">${order.status}</span>
            </div>
            <div style="margin:10px 0;">
                ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
            </div>
            <small>${new Date(order.createdAt).toLocaleString()}</small>
        </div>
    `).join('');
}

// 后厨管理
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
    const allOrders = await res.json();
    const waitingOrders = allOrders.filter(o => o.status !== 'done');
    
    document.getElementById('waiting-count').textContent = waitingOrders.length;
    document.getElementById('today-completed').textContent = allOrders.filter(o => o.status === 'done').length;

    const container = document.getElementById('kitchen-orders');
    container.innerHTML = waitingOrders.map(order => `
        <div class="order-card">
            <h3>订单 #${order.id.toString().slice(-4)}</h3>
            ${order.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
            <div style="margin-top:10px;">
                ${order.status === 'waiting' ? 
                    `<button class="btn" style="background:#1e90ff; color:white;" onclick="updateOrderStatus(${order.id}, 'cooking')">开始制作</button>` :
                    `<button class="btn" style="background:#2ed573; color:white;" onclick="updateOrderStatus(${order.id}, 'done')">完成制作</button>`
                }
            </div>
        </div>
    `).join('');
}

// --- 辅助功能 ---

function addToCart(dishId) {
    const dish = dishData.find(d => d.id === dishId);
    const existing = cart.find(i => i.id === dishId);
    if (existing) { existing.quantity++; } 
    else { cart.push({ ...dish, quantity: 1 }); }
    saveCartToLocal();
    updateCartCount();
    showNotification(`已添加 ${dish.name}`);
}

function updateCartCount() {
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').textContent = total;
}

function saveCartToLocal() { localStorage.setItem('kitchenCart', JSON.stringify(cart)); }
function loadCartFromLocal() { cart = JSON.parse(localStorage.getItem('kitchenCart') || '[]'); }

function showNotification(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function filterDishes(cat) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    const filtered = cat === 'all' ? dishData : dishData.filter(d => d.category === cat);
    renderDishes(filtered);
}

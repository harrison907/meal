let dishData = [];
let cart = [];
let orders = [];

// 初始化
async function initApp() {
    try {
        await loadData();
        // 每隔10秒自动刷新一次后厨（不用手动点刷新）
        if (document.getElementById('kitchen-orders')) {
            setInterval(loadData, 10000); 
        }
    } catch (e) { console.error(e); }
}

async function loadData() {
    const resM = await fetch('/api/menu');
    dishData = await resM.json();
    const resO = await fetch('/api/orders');
    orders = await resO.json();

    // 根据当前页面决定渲染什么
    if (document.getElementById('dish-list')) renderDishes(dishData);
    if (document.getElementById('orders-list')) renderOrders();
    if (document.getElementById('kitchen-orders')) renderKitchen();
    updateCartCount();
}

// 计算某道菜的平均分（给前厅和后厨看）
function getAvg(name) {
    const rated = orders.filter(o => o.rating > 0 && o.items.some(i => i.name === name));
    if (rated.length === 0) return "⭐⭐⭐⭐⭐";
    const sum = rated.reduce((s, o) => s + o.rating, 0);
    return `⭐ ${(sum / rated.length).toFixed(1)}`;
}

// --- 后厨渲染逻辑 ---
function renderKitchen() {
    const container = document.getElementById('kitchen-orders');
    const waiting = orders.filter(o => o.status !== 'done');
    
    document.getElementById('waiting-count').textContent = waiting.length;
    document.getElementById('today-completed').textContent = orders.filter(o => o.status === 'done').length;

    if (waiting.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px; color:#999;">暂时没有待办订单，休息一下吧~</div>';
        return;
    }

    container.innerHTML = waiting.map(order => `
        <div class="kitchen-card">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <strong style="font-size:18px;">订单 #${order._id.slice(-4)}</strong>
                <span class="status-${order.status}" style="padding:2px 8px; border-radius:10px; font-size:12px;">${order.status === 'waiting' ? '排队中' : '制作中'}</span>
            </div>
            
            <div style="margin-bottom:15px;">
                ${order.items.map(item => `
                    <div class="dish-info">
                        <span><strong>${item.emoji} ${item.name}</strong> x ${item.quantity}</span>
                        <span class="avg-tag">口碑: ${getAvg(item.name)}</span>
                    </div>
                `).join('')}
            </div>

            <div style="display:flex; gap:10px;">
                ${order.status === 'waiting' ? 
                    `<button class="btn" style="flex:1; background:#1e90ff; color:white;" onclick="updateStatus('${order._id}', 'cooking')">开始制作</button>` :
                    `<button class="btn" style="flex:1; background:#2ed573; color:white;" onclick="updateStatus('${order._id}', 'done')">大功告成</button>`
                }
            </div>
        </div>
    `).join('');
}

// --- 前厅渲染逻辑 ---
function renderDishes(data) {
    const container = document.getElementById('dish-list');
    if(!container) return;
    container.innerHTML = data.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span style="font-size:48px;">${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff9f43; font-size:12px; margin:5px 0;">平均: ${getAvg(dish.name)}</div>
            <button class="btn" style="background:#ff6b8b; color:white; margin-top:5px; border-radius:15px;">加入清单</button>
        </div>
    `).join('');
}

// 修改状态
async function updateStatus(id, status) {
    await fetch(`/api/order/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ status })
    });
    if (status === 'done') showNotification("又完成了一道美食！👏");
    await loadData();
}

// 评价功能
async function rateOrder(id, score) {
    await fetch(`/api/order/${id}/rate`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ rating: score })
    });
    showNotification("评价成功！❤️");
    await loadData();
}

// --- 其他通用功能 ---
function addToCart(id) {
    const dish = dishData.find(d => d._id === id);
    let localCart = JSON.parse(localStorage.getItem('kitchenCart') || '[]');
    const exist = localCart.find(i => i._id === id);
    if(exist) exist.quantity++; else localCart.push({...dish, quantity:1});
    localStorage.setItem('kitchenCart', JSON.stringify(localCart));
    updateCartCount();
    showNotification(`已添加 ${dish.name} ❤️`);
}

function updateCartCount() {
    const localCart = JSON.parse(localStorage.getItem('kitchenCart') || '[]');
    const count = localCart.reduce((s, i) => s + i.quantity, 0);
    const el = document.getElementById('cart-count');
    if(el) el.textContent = count;
}

async function submitOrder() {
    const localCart = JSON.parse(localStorage.getItem('kitchenCart') || '[]');
    if(localCart.length === 0) return showNotification("清单是空的");
    await fetch('/api/order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ items: localCart })
    });
    localStorage.removeItem('kitchenCart');
    updateCartCount();
    window.location.reload(); // 简单粗暴刷新看订单
}

function showNotification(msg) {
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// 标签切换逻辑
function switchTab(tab) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const target = document.getElementById(`${tab}-page`);
    if(target) target.classList.add('active');
    const btn = document.querySelector(`[onclick*="'${tab}'"]`);
    if(btn) btn.classList.add('active');
}

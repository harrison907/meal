let dishData = [];
let cart = [];
let orders = [];
let messages = [];

// 初始化
window.initApp = async function() {
    await loadData();
    if (!window.syncTimer) window.syncTimer = setInterval(loadData, 3000);
}
document.addEventListener('DOMContentLoaded', () => { if(!document.body.onload) initApp(); });

// --- script.js 里的 loadData 替换为这个调试版 ---
async function loadData() {
    try {
        const [resM, resO, resW, resMsg] = await Promise.all([
            fetch('/api/menu'), fetch('/api/orders'), fetch('/api/wallet'), fetch('/api/messages')
        ]);
        
        // 检查请求是否成功
        if (!resM.ok || !resO.ok || !resW.ok || !resMsg.ok) {
            throw new Error("某个接口返回了非200状态码");
        }

        dishData = await resM.json();
        orders = await resO.json();
        const wallet = await resW.json();
        messages = await resMsg.json();

        if (document.getElementById('user-balance')) document.getElementById('user-balance').textContent = wallet.balance.toFixed(2);
        if (document.getElementById('chat-messages')) renderChat();
        if (document.getElementById('kitchen-orders')) renderKitchen();
        if (document.getElementById('dish-list')) renderDishes();
        if (document.getElementById('manage-dish-list')) renderManageLists();
        if (document.getElementById('orders-list')) renderOrders();
        updateCartCount();
    } catch (e) { 
        // 这样你可以看到具体的报错信息
        console.error("同步失败具体原因:", e); 
    }
}

// 修改 renderDishes，如果没有菜显示提示
function renderDishes() {
    const container = document.getElementById('dish-list');
    if (!container) return;
    const approved = dishData.filter(d => d.isApproved);
    
    if (approved.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align:center; padding:50px; color:#999;">菜单是空的，快去“提议菜品”或让大厨在后厨上架吧！</p>`;
        return;
    }

    container.innerHTML = approved.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span>${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff4757; font-weight:bold;">￥${dish.price}</div>
        </div>
    `).join('');
}

// 评分计算
function getAvg(name) {
    const rated = orders.filter(o => o.rating > 0 && o.items.some(i => i.name === name));
    if (rated.length === 0) return "⭐⭐⭐⭐⭐";
    const sum = rated.reduce((s, o) => s + o.rating, 0);
    return `⭐ ${(sum / rated.length).toFixed(1)}`;
}

// 1. 菜品管理
window.addDish = async function(role) {
    const name = document.getElementById('new-dish-name').value;
    const emoji = document.getElementById('new-dish-emoji').value;
    const priceEl = document.getElementById('new-dish-price');
    const price = priceEl ? parseFloat(priceEl.value) : 0;
    if (!name || !emoji) return alert("请填完名称和图标");
    await fetch('/api/menu', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, emoji, price, isApproved: (role === 'chef') })
    });
    document.getElementById('new-dish-name').value = '';
    document.getElementById('new-dish-emoji').value = '';
    alert(role === 'chef' ? "已上架" : "提议成功，等待审核~");
    loadData();
}

window.approveDish = async function(id) {
    const price = prompt("定价为 (￥)：");
    if (!price) return;
    await fetch(`/api/menu/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ isApproved: true, price: parseFloat(price) }) });
    loadData();
}

window.deleteDish = async function(id) {
    if (confirm("确定删除？")) { await fetch(`/api/menu/${id}`, { method: 'DELETE' }); loadData(); }
}

window.editDish = async function(id, role) {
    const dish = dishData.find(d => d._id === id);
    const name = prompt("改名：", dish.name);
    const emoji = prompt("改图标：", dish.emoji);
    let data = { name, emoji };
    if (role === 'chef') data.price = parseFloat(prompt("改价格：", dish.price));
    await fetch(`/api/menu/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
    loadData();
}

// 2. 渲染函数
function renderDishes() {
    const container = document.getElementById('dish-list');
    const approved = dishData.filter(d => d.isApproved);
    container.innerHTML = approved.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span>${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff4757; font-weight:bold;">￥${dish.price} <small style="font-weight:normal; color:#999; font-size:10px;">(${getAvg(dish.name)})</small></div>
        </div>
    `).join('');
}

function renderManageLists() {
    const pendingContainer = document.getElementById('pending-dishes');
    if (pendingContainer) {
        pendingContainer.innerHTML = dishData.filter(d => !d.isApproved).map(d => `
            <div class="cart-item"><span>${d.emoji} ${d.name}</span>
            <button onclick="approveDish('${d._id}')">定价上架</button></div>
        `).join('');
    }
    const manageContainer = document.getElementById('manage-dish-list');
    if (manageContainer) {
        const isChef = !!document.getElementById('pending-dishes');
        manageContainer.innerHTML = dishData.filter(d => d.isApproved).map(d => `
            <div class="cart-item"><span>${d.emoji} ${d.name} (￥${d.price})</span>
            <button onclick="editDish('${d._id}', '${isChef?'chef':'user'}')">改</button>
            <button onclick="deleteDish('${d._id}')">删</button></div>
        `).join('');
    }
}

function renderKitchen() {
    const container = document.getElementById('kitchen-orders');
    const waiting = orders.filter(o => o.status !== 'done');
    document.getElementById('waiting-count').textContent = waiting.length;
    document.getElementById('today-completed').textContent = orders.filter(o => o.status === 'done').length;
    container.innerHTML = waiting.map(o => `
        <div class="order-card">
            <strong>单号 #${o._id.slice(-4)}</strong>
            <div>${o.items.map(i => `${i.name} x ${i.quantity}`).join(', ')}</div>
            <button class="btn" style="background:#2ed573; color:white; width:100%; margin-top:10px;" onclick="updateStatus('${o._id}', 'done')">完成制作</button>
        </div>
    `).join('');
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = orders.map(o => `
        <div class="order-card">
            <div style="display:flex; justify-content:space-between;"><strong>单号 #${o._id.slice(-4)}</strong><span>${o.status}</span></div>
            <div>${o.items.map(i => `${i.name} x ${i.quantity}`).join(', ')}</div>
            <div style="font-size:12px; color:#999;">总价: ￥${o.totalPrice.toFixed(2)}</div>
            ${o.status === 'done' && o.rating === 0 ? `<div style="margin-top:5px;">打分：${[1,2,3,4,5].map(n => `<button onclick="rateOrder('${o._id}', ${n})">${n}⭐</button>`).join('')}</div>` : o.rating > 0 ? `评分: ${o.rating}⭐` : ''}
        </div>
    `).join('');
}

// 3. 通用功能
window.switchTab = function(tab) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const p = document.getElementById(`${tab}-page`);
    const b = document.querySelector(`[onclick*="'${tab}'"]`);
    if(p) p.classList.add('active'); if(b) b.classList.add('active');
    if(tab==='cart') renderCart();
};

window.addToCart = function(id) {
    const d = dishData.find(i => i._id === id);
    const ex = cart.find(i => i._id === id);
    if(ex) ex.quantity++; else cart.push({...d, quantity:1});
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
    updateCartCount(); showNotification(`已加 ${d.name} ❤️`);
};

window.renderCart = function() {
    const c = document.getElementById('cart-items');
    const t = document.getElementById('cart-total');
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    if(t) t.textContent = total.toFixed(2);
    c.innerHTML = cart.map(i => `<div class="cart-item"><span>${i.name} x ${i.quantity} (￥${i.price})</span><button onclick="removeFromCart('${i._id}')">删</button></div>`).join('');
};

window.removeFromCart = function(id) { cart = cart.filter(i => i._id !== id); localStorage.setItem('kitchenCart', JSON.stringify(cart)); renderCart(); updateCartCount(); };

window.submitOrder = async function() {
    const res = await fetch('/api/order', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ items: cart }) });
    const json = await res.json();
    if(!json.success) alert(json.message); else { cart = []; localStorage.removeItem('kitchenCart'); switchTab('orders'); initApp(); }
};

window.updateStatus = async function(id, status) { await fetch(`/api/order/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status }) }); loadData(); };
window.rateOrder = async function(id, rating) { await fetch(`/api/order/${id}/rate`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ rating }) }); loadData(); };
window.sendMessage = async function(sender) { const i = document.getElementById('chat-input'); if(!i.value) return; await fetch('/api/messages', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sender, content: i.value }) }); i.value = ''; loadData(); };
function renderChat() { const c = document.getElementById('chat-messages'); c.innerHTML = messages.map(m => `<div style="text-align:${m.sender==='chef'?'left':'right'}"><span style="background:${m.sender==='chef'?'#eee':'#ff6b8b'}; color:${m.sender==='chef'?'#333':'#fff'}; padding:5px 10px; border-radius:10px; margin:2px; display:inline-block;">${m.content}</span></div>`).join(''); c.scrollTop = c.scrollHeight; }
function updateCartCount() { const el = document.getElementById('cart-count'); if(el) el.textContent = cart.reduce((s,i)=>s+i.quantity, 0); }
function showNotification(msg) { const t = document.getElementById('toast'); if(t) { t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 3000); } }


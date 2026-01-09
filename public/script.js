let dishData = [];
let cart = [];
let orders = [];
let messages = [];

window.initApp = async function() {
    restoreCart();
    await loadData();
    if (!window.syncTimer) {
        window.syncTimer = setInterval(loadData, 5000); // 改为5秒一次
    }
};

async function loadData() {
    try {
        const [resM, resO, resW, resMsg] = await Promise.allSettled([
            fetch('/api/menu').then(r => r.ok ? r.json() : []),
            fetch('/api/orders').then(r => r.ok ? r.json() : []),
            fetch('/api/wallet').then(r => r.ok ? r.json() : { balance: 0 }),
            fetch('/api/messages').then(r => r.ok ? r.json() : [])
        ]);
        
        dishData = resM.status === 'fulfilled' ? resM.value : [];
        orders = resO.status === 'fulfilled' ? resO.value : [];
        const wallet = resW.status === 'fulfilled' ? resW.value : { balance: 0 };
        messages = resMsg.status === 'fulfilled' ? resMsg.value : [];
        
        if (document.getElementById('user-balance')) {
            document.getElementById('user-balance').textContent = wallet.balance.toFixed(2);
        }
        
        debounce(renderCurrentPage, 100)();
        updateCartCount();
    } catch (e) { 
        console.warn("数据同步失败:", e);
        showNotification("网络连接不稳定");
    }
}


// 防抖函数
let debounceTimer;
function debounce(func, delay) {
    return function(...args) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

// 购物车恢复
function restoreCart() {
    try {
        const savedCart = localStorage.getItem('kitchenCart');
        if (savedCart) {
            const parsed = JSON.parse(savedCart);
            cart = parsed.filter(item => item.price > 0 && item.name);
        }
    } catch (e) {
        console.warn("购物车恢复失败:", e);
    }
}

// 统一渲染当前页面逻辑
function renderCurrentPage() {
    if (document.getElementById('chat-messages')) renderChat();
    if (document.getElementById('kitchen-orders')) renderKitchen();
    if (document.getElementById('dish-list')) renderDishes();
    if (document.getElementById('orders-list')) renderOrders();
    if (document.getElementById('manage-dish-list')) renderManageLists();
    if (document.getElementById('pending-dishes')) renderPendingDishes();
}

// --- 订单与状态渲染 ---
function renderOrders() {
    const container = document.getElementById('orders-list');
    if(!container) return;
    container.innerHTML = orders.map(o => {
        // 修复 toFixed 报错：增加默认值保护
        const displayPrice = (o.totalPrice || 0).toFixed(2);
        const statusMap = { 'waiting': '⏳ 正在排队', 'cooking': '👨‍🍳 大厨正在制作中...', 'done': '✅ 已经做好啦！快来吃' };
        
        return `
            <div class="order-card" style="border-left: 5px solid ${o.status==='done'?'#2ed573':'#ff9f43'}">
                <div style="display:flex; justify-content:space-between;">
                    <strong>订单状态: ${statusMap[o.status]}</strong>
                </div>
                <div style="margin:10px 0; font-size:14px;">
                    ${o.items.map(i => `<div>${i.emoji} ${i.name} x ${i.quantity}</div>`).join('')}
                </div>
                <div style="font-size:12px; color:#999;">支付金额: ￥${displayPrice} | 时间: ${new Date(o.createdAt).toLocaleString()}</div>
                ${o.status === 'done' && o.rating === 0 ? `
                    <div style="margin-top:10px; border-top:1px dashed #ddd; padding-top:10px;">
                        打个分：${[1,2,3,4,5].map(n => `<button onclick="rateOrder('${o._id}', ${n})">${n}⭐</button>`).join('')}
                    </div>
                ` : o.rating > 0 ? `<div style="color:#ff9f43; margin-top:5px;">我的评分: ${o.rating}⭐</div>` : ''}
            </div>
        `;
    }).join('');
}

function renderKitchen() {
    const container = document.getElementById('kitchen-orders');
    if(!container) return;
    const active = orders.filter(o => o.status !== 'done');
    document.getElementById('waiting-count').textContent = active.length;
    document.getElementById('today-completed').textContent = orders.filter(o => o.status === 'done').length;

    container.innerHTML = active.map(o => `
        <div class="order-card">
            <h3>单号 #${o._id.slice(-4)} (${o.status==='waiting'?'待制作':'制作中'})</h3>
            <div style="margin:10px 0;">${o.items.map(i => `${i.emoji} ${i.name} x ${i.quantity}`).join(', ')}</div>
            <div style="display:flex; gap:10px;">
                ${o.status === 'waiting' ? 
                    `<button class="btn" style="background:#1e90ff; color:white; flex:1;" onclick="updateStatus('${o._id}', 'cooking')">开始做</button>` :
                    `<button class="btn" style="background:#2ed573; color:white; flex:1;" onclick="updateStatus('${o._id}', 'done')">做好了</button>`
                }
            </div>
        </div>
    `).join('');
}

// --- 提议与审核渲染 ---
function renderPendingDishes() {
    const container = document.getElementById('pending-dishes');
    if(!container) return;
    const pending = dishData.filter(d => !d.isApproved);
    container.innerHTML = pending.length === 0 ? '<p style="color:#999;">暂无新提议</p>' : pending.map(d => `
        <div class="cart-item">
            <span>${d.emoji} ${d.name}</span>
            <button onclick="approveDish('${d._id}')">审核定价</button>
        </div>
    `).join('');
}

// 标签切换逻辑
window.switchTab = function(tab) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const p = document.getElementById(`${tab}-page`);
    const b = document.querySelector(`[onclick*="'${tab}'"]`);
    if(p) p.classList.add('active'); if(b) b.classList.add('active');
    renderCurrentPage();
};

// --- 以下功能代码保持逻辑一致 ---
window.addDish = async function(role) {
    const name = document.getElementById('new-dish-name').value;
    const emoji = document.getElementById('new-dish-emoji').value;
    const priceEl = document.getElementById('new-dish-price');
    const price = priceEl ? parseFloat(priceEl.value) : 0;
    if (!name || !emoji) return;
    await fetch('/api/menu', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, emoji, price, isApproved: (role === 'chef') }) });
    document.getElementById('new-dish-name').value = ''; document.getElementById('new-dish-emoji').value = '';
    alert("操作成功"); loadData();
};

window.approveDish = async function(id) {
    const price = prompt("定价为：");
    if (!price) return;
    await fetch(`/api/menu/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ isApproved: true, price: parseFloat(price) }) });
    loadData();
};

window.renderChat = function() {
    const c = document.getElementById('chat-messages'); if(!c) return;
    c.innerHTML = messages.map(m => `<div style="text-align:${m.sender==='chef'?'left':'right'}"><span style="background:${m.sender==='chef'?'#eee':'#ff6b8b'}; color:${m.sender==='chef'?'#333':'#fff'}; padding:8px 12px; border-radius:15px; margin:4px; display:inline-block; max-width:80%;">${m.content}</span></div>`).join('');
    c.scrollTop = c.scrollHeight;
};

window.sendMessage = async function(sender) {
    const i = document.getElementById('chat-input'); if(!i.value) return;
    await fetch('/api/messages', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sender, content: i.value }) });
    i.value = ''; loadData();
};

window.renderDishes = function() {
    const container = document.getElementById('dish-list'); if(!container) return;
    container.innerHTML = dishData.filter(d => d.isApproved).map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span>${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff4757; font-weight:bold;">￥${dish.price}</div>
        </div>
    `).join('');
};

window.renderManageLists = function() {
    const container = document.getElementById('manage-dish-list'); if(!container) return;
    const isChef = !!document.getElementById('pending-dishes');
    container.innerHTML = dishData.filter(d => d.isApproved).map(d => `
        <div class="cart-item">
            <span>${d.emoji} ${d.name} ${isChef?`(￥${d.price})`:''}</span>
            <div style="display:flex; gap:5px;">
                <button onclick="editDish('${d._id}', '${isChef?'chef':'user'}')">改</button>
                <button onclick="deleteDish('${d._id}')">删</button>
            </div>
        </div>
    `).join('');
};

// 补全基础操作
window.addToCart = function(id) { const d = dishData.find(i => i._id === id); const ex = cart.find(i => i._id === id); if(ex) ex.quantity++; else cart.push({...d, quantity:1}); localStorage.setItem('kitchenCart', JSON.stringify(cart)); updateCartCount(); showNotification(`加了 ${d.name} ❤️`); };
window.updateCartCount = function() { const el = document.getElementById('cart-count'); if(el) el.textContent = cart.reduce((s,i)=>s+i.quantity, 0); };
window.renderCart = function() { const c = document.getElementById('cart-items'); const t = document.getElementById('cart-total'); const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0); if(t) t.textContent = total.toFixed(2); c.innerHTML = cart.map(i => `<div class="cart-item"><span>${i.name} x ${i.quantity} (￥${i.price})</span><button onclick="removeFromCart('${i._id}')">删</button></div>`).join(''); };
window.removeFromCart = function(id) { cart = cart.filter(i => i._id !== id); localStorage.setItem('kitchenCart', JSON.stringify(cart)); renderCart(); updateCartCount(); };
window.submitOrder = async function() { const res = await fetch('/api/order', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ items: cart }) }); const json = await res.json(); if(!json.success) alert(json.message); else { cart = []; localStorage.removeItem('kitchenCart'); switchTab('orders'); loadData(); } };
window.updateStatus = async function(id, status) { await fetch(`/api/order/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status }) }); loadData(); };
window.rateOrder = async function(id, rating) { await fetch(`/api/order/${id}/rate`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ rating }) }); loadData(); };
window.deleteDish = async function(id) { if(confirm("删？")) { await fetch(`/api/menu/${id}`, { method: 'DELETE' }); loadData(); } };
window.editDish = async function(id, role) { const dish = dishData.find(d => d._id === id); const name = prompt("改名：", dish.name); const emoji = prompt("改图标：", dish.emoji); let data = { name, emoji }; if (role === 'chef') data.price = parseFloat(prompt("改价格：", dish.price)); await fetch(`/api/menu/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }); loadData(); };
function showNotification(msg) { const t = document.getElementById('toast'); if(t) { t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 3000); } }



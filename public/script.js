let dishData = [];
let cart = [];
let orders = [];
let messages = [];

async function initApp() {
    await loadData();
    // 每3秒刷新聊天和数据
    if (!window.chatTimer) window.chatTimer = setInterval(loadData, 3000);
}

async function loadData() {
    const resM = await fetch('/api/menu');
    dishData = await resM.json();
    const resO = await fetch('/api/orders');
    orders = await resO.json();
    const resW = await fetch('/api/wallet');
    const wallet = await resW.json();
    const resMsg = await fetch('/api/messages');
    messages = await resMsg.json();

    // 更新余额显示
    const balEl = document.getElementById('user-balance');
    if (balEl) balEl.textContent = wallet.balance.toFixed(2);

    // 渲染各个部分
    if (document.getElementById('dish-list')) renderDishes();
    if (document.getElementById('kitchen-orders')) renderKitchen();
    if (document.getElementById('chat-messages')) renderChat();
    if (document.getElementById('manage-dish-list')) renderManageList();
    if (document.getElementById('orders-list')) renderOrders();
    updateCartCount();
}

// 渲染菜单（带价格）
function renderDishes() {
    const container = document.getElementById('dish-list');
    if(!container) return;
    container.innerHTML = dishData.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span>${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff4757; font-weight:bold;">￥${dish.price || 0}</div>
            <button class="btn-small">加入清单</button>
        </div>
    `).join('');
}

// 聊天功能
async function sendMessage(sender) {
    const input = document.getElementById('chat-input');
    const content = input.value;
    if (!content) return;

    await fetch('/api/messages', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sender, content })
    });
    input.value = '';
    loadData();
}

function renderChat() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = messages.map(m => `
        <div style="margin-bottom:8px; text-align: ${m.sender === 'chef' ? 'left' : 'right'};">
            <span style="background:${m.sender === 'chef' ? '#eee' : '#ff6b8b'}; color:${m.sender === 'chef' ? '#333' : '#fff'}; padding:5px 10px; border-radius:10px; display:inline-block; max-width:80%;">
                ${m.content}
            </span>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

// 管理员添加菜品 (包含价格)
async function addDish() {
    const name = document.getElementById('new-dish-name').value;
    const emoji = document.getElementById('new-dish-emoji').value;
    const price = document.getElementById('new-dish-price').value;
    if(!name || !price) return;

    await fetch('/api/menu', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, emoji, price: parseFloat(price), time: 10 })
    });
    initApp();
}

// 订单提交逻辑（带余额提示）
async function submitOrder() {
    if (cart.length === 0) return;
    const res = await fetch('/api/order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ items: cart })
    });
    const result = await res.json();
    if (!result.success) {
        alert(result.message);
    } else {
        cart = [];
        localStorage.removeItem('kitchenCart');
        switchTab('orders');
        initApp();
    }
}

// ... 其余 switchTab, addToCart 等逻辑保持不变 ...

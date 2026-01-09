let dishData = [];
let cart = [];
let orders = [];
let messages = [];

// 初始化
window.initApp = async function() {
    await loadData();
    if (!window.syncTimer) window.syncTimer = setInterval(loadData, 3000);
}

async function loadData() {
    try {
        const [resM, resO, resW, resMsg] = await Promise.all([
            fetch('/api/menu'), fetch('/api/orders'), fetch('/api/wallet'), fetch('/api/messages')
        ]);
        dishData = await resM.json();
        orders = await resO.json();
        const wallet = await resW.json();
        messages = await resMsg.json();

        // UI 更新
        if (document.getElementById('user-balance')) document.getElementById('user-balance').textContent = wallet.balance.toFixed(2);
        if (document.getElementById('chat-messages')) renderChat();
        if (document.getElementById('kitchen-orders')) renderKitchen();
        
        // 分别渲染前厅和后厨的管理列表
        if (document.getElementById('dish-list')) renderDishes(); // 前厅菜单只显Approved
        if (document.getElementById('manage-dish-list')) renderManageLists(); // 统一调用管理渲染
        
        updateCartCount();
    } catch (e) { console.warn("同步中..."); }
}

// --- 菜品管理核心逻辑 ---

// 1. 前厅/后厨通用的增加菜品
window.addDish = async function(role) {
    const name = document.getElementById('new-dish-name').value;
    const emoji = document.getElementById('new-dish-emoji').value;
    const priceInput = document.getElementById('new-dish-price');
    const price = priceInput ? parseFloat(priceInput.value) : 0;

    if (!name || !emoji) return alert("请填完名称和图标");

    // 如果是前厅添加，isApproved 为 false
    // 如果是后厨添加，isApproved 为 true
    const isApproved = (role === 'chef');

    await fetch('/api/menu', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, emoji, price, isApproved })
    });

    document.getElementById('new-dish-name').value = '';
    document.getElementById('new-dish-emoji').value = '';
    if(priceInput) priceInput.value = '';
    
    alert(role === 'chef' ? "已直接上架" : "已提交提议，等待TA审核哦~");
    loadData();
}

// 2. 后厨审核并通过
window.approveDish = async function(id) {
    const price = prompt("给这道新菜定个价吧 (￥)：");
    if (price === null) return;
    await fetch(`/api/menu/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ isApproved: true, price: parseFloat(price) })
    });
    loadData();
}

// 3. 修改菜品 (前厅改名/图标，后厨改全部)
window.editDish = async function(id, role) {
    const dish = dishData.find(d => d._id === id);
    const newName = prompt("修改名称：", dish.name);
    const newEmoji = prompt("修改图标：", dish.emoji);
    let updateData = { name: newName, emoji: newEmoji };

    if (role === 'chef') {
        const newPrice = prompt("修改价格：", dish.price);
        updateData.price = parseFloat(newPrice);
    }

    await fetch(`/api/menu/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updateData)
    });
    loadData();
}

window.deleteDish = async function(id) {
    if (!confirm("确定要下架这道菜吗？")) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    loadData();
}

// --- 渲染逻辑 ---

function renderDishes() {
    const container = document.getElementById('dish-list');
    if (!container) return;
    // 前厅菜单：只显示已审核通过的
    const approvedDishes = dishData.filter(d => d.isApproved);
    container.innerHTML = approvedDishes.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span>${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="color:#ff4757; font-weight:bold;">￥${dish.price}</div>
            <button class="btn-small">加入清单</button>
        </div>
    `).join('');
}

function renderManageLists() {
    // 后厨待审核列表
    const pendingContainer = document.getElementById('pending-dishes');
    if (pendingContainer) {
        const pending = dishData.filter(d => !d.isApproved);
        pendingContainer.innerHTML = pending.map(d => `
            <div style="display:flex; justify-content:space-between; padding:10px; background:#fff; border-radius:8px; margin-bottom:5px;">
                <span>${d.emoji} ${d.name} (待定)</span>
                <div>
                    <button onclick="approveDish('${d._id}')" style="color:green;">定价上架</button>
                    <button onclick="deleteDish('${d._id}')" style="color:red;">拒绝</button>
                </div>
            </div>
        `).join('');
    }

    // 已上架管理列表 (前厅或后厨)
    const manageContainer = document.getElementById('manage-dish-list');
    if (manageContainer) {
        const isChefPage = !!document.getElementById('pending-dishes');
        const role = isChefPage ? 'chef' : 'user';
        const approved = dishData.filter(d => d.isApproved);
        manageContainer.innerHTML = approved.map(d => `
            <div style="display:flex; justify-content:space-between; padding:10px; background:#fff; border-radius:8px; margin-bottom:5px;">
                <span>${d.emoji} ${d.name} ${isChefPage ? `(￥${d.price})` : ''}</span>
                <div>
                    <button onclick="editDish('${d._id}', '${role}')">编辑</button>
                    <button onclick="deleteDish('${d._id}')">删除</button>
                </div>
            </div>
        `).join('');
    }
}

// --- 其余辅助函数 (聊天、购物车、订单、状态切换等) 全部保持与最终完整版一致 ---
// (由于篇幅，此处省略，请确保你保留了上一次我发给你的 switchTab, sendMessage, renderChat, renderKitchen 等所有函数)
// 记得在 script.js 最下面加上之前的 switchTab, renderChat, renderKitchen, addToCart, submitOrder 等函数！

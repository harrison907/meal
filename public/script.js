// 全局状态
let dishes = [];
let cart = [];
let orders = [];
let currentTab = 'menu';

// 菜品数据
const dishData = [
    { id: 1, name: "爱心煎蛋", category: "breakfast", time: 5, emoji: "🍳", difficulty: "★☆☆☆☆" },
    { id: 2, name: "甜蜜三明治", category: "breakfast", time: 10, emoji: "🥪", difficulty: "★☆☆☆☆" },
    { id: 3, name: "阳光沙拉", category: "lunch", time: 15, emoji: "🥗", difficulty: "★★☆☆☆" },
    { id: 4, name: "浪漫意面", category: "lunch", time: 25, emoji: "🍝", difficulty: "★★★☆☆" },
    { id: 5, name: "幸福咖喱饭", category: "lunch", time: 30, emoji: "🍛", difficulty: "★★★☆☆" },
    { id: 6, name: "心动布丁", category: "dessert", time: 15, emoji: "🍮", difficulty: "★★☆☆☆" },
    { id: 7, name: "温暖热可可", category: "drink", time: 5, emoji: "☕", difficulty: "★☆☆☆☆" },
    { id: 8, name: "惊喜蛋包饭", category: "lunch", time: 20, emoji: "🍚", difficulty: "★★★★☆" }
];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadDishes();
    loadCart();
    loadOrders();
    updateCartCount();
    showNotification("欢迎来到情侣厨房！❤️");
});

// 切换标签页
function switchTab(tabName) {
    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    
    // 激活新标签页
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}-page`).classList.add('active');
    
    currentTab = tabName;
    
    // 刷新页面内容
    if (tabName === 'menu') loadDishes();
    if (tabName === 'cart') loadCart();
    if (tabName === 'orders') loadOrders();
    if (tabName === 'kitchen') loadKitchen();
}

// 加载菜品
function loadDishes() {
    const container = document.getElementById('dish-list');
    container.innerHTML = dishData.map(dish => `
        <div class="dish-card" onclick="addToCart(${dish.id})">
            <div class="dish-image">
                <span style="font-size: 48px;">${dish.emoji}</span>
            </div>
            <div class="dish-name">${dish.name}</div>
            <div class="dish-time">⏰ ${dish.time}分钟 | ${dish.difficulty}</div>
            <button class="btn" style="background: #ff6b8b; color: white; padding: 8px 16px; margin-top: 10px;">
                加入清单
            </button>
        </div>
    `).join('');
}

// 添加到购物车
function addToCart(dishId) {
    const dish = dishData.find(d => d.id === dishId);
    const existing = cart.find(item => item.id === dishId);
    
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            ...dish,
            quantity: 1,
            note: ""
        });
    }
    
    saveCart();
    updateCartCount();
    showNotification(`已添加 ${dish.name} 到购物车！`);
    
    if (currentTab === 'menu') {
        loadCart(); // 如果就在购物车页面，刷新显示
    }
}

// 加载购物车
function loadCart() {
    const container = document.getElementById('cart-items');
    if (cart.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 60px; margin-bottom: 20px;">🛒</div>
                <h3>购物车是空的</h3>
                <p>快去菜单选些好吃的吧！</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = cart.map(item => `
        <div class="cart-item" style="background: white; padding: 15px; margin-bottom: 10px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h4>${item.emoji} ${item.name}</h4>
                <p style="color: #666; font-size: 14px;">${item.time}分钟 | ${item.difficulty}</p>
                <input type="text" 
                       placeholder="添加备注（比如：少放盐）" 
                       style="width: 100%; padding: 5px; margin-top: 5px; border: 1px solid #ddd; border-radius: 5px;"
                       value="${item.note}"
                       onchange="updateCartNote(${item.id}, this.value)">
            </div>
            <div style="text-align: right;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button onclick="updateQuantity(${item.id}, -1)" style="width: 30px; height: 30px; border-radius: 50%; border: none; background: #f1f2f6; cursor: pointer;">-</button>
                    <span style="min-width: 20px; text-align: center;">${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, 1)" style="width: 30px; height: 30px; border-radius: 50%; border: none; background: #f1f2f6; cursor: pointer;">+</button>
                </div>
                <button onclick="removeFromCart(${item.id})" style="background: none; border: none; color: #ff4757; cursor: pointer; font-size: 12px; margin-top: 5px;">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        </div>
    `).join('');
}

// 更新购物车商品数量
function updateQuantity(dishId, change) {
    const item = cart.find(item => item.id === dishId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(dishId);
        } else {
            saveCart();
            loadCart();
        }
    }
}

// 更新购物车备注
function updateCartNote(dishId, note) {
    const item = cart.find(item => item.id === dishId);
    if (item) {
        item.note = note;
        saveCart();
    }
}

// 从购物车移除
function removeFromCart(dishId) {
    cart = cart.filter(item => item.id !== dishId);
    saveCart();
    loadCart();
    updateCartCount();
}

// 提交订单
function submitOrder() {
    if (cart.length === 0) {
        showNotification("请先选择菜品！");
        return;
    }
    
    const order = {
        id: Date.now(),
        items: [...cart],
        status: 'waiting',
        createdAt: new Date().toLocaleString(),
        updatedAt: new Date().toLocaleString()
    };
    
    orders.push(order);
    cart = [];
    
    saveOrders();
    saveCart();
    updateCartCount();
    
    // 切换到订单页面
    switchTab('orders');
    
    // 显示成功消息
    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
    showNotification(`🎉 订单已发送！共 ${totalItems} 道菜，等待TA制作吧！`);
    
    // 模拟发送通知（实际项目中需要后端推送）
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('新订单来啦！', {
            body: '有新的美食订单等待制作',
            icon: '/favicon.ico'
        });
    }
}

// 加载订单
function loadOrders() {
    const container = document.getElementById('orders-list');
    if (orders.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 60px; margin-bottom: 20px;">📝</div>
                <h3>还没有订单哦</h3>
                <p>快去下单让TA为你下厨吧！</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = orders.map(order => {
        const statusText = {
            'waiting': '等待制作',
            'cooking': '制作中',
            'done': '已完成'
        };
        
        const statusClass = {
            'waiting': 'status-waiting',
            'cooking': 'status-cooking',
            'done': 'status-done'
        };
        
        return `
            <div class="order-card">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h3>订单 #${order.id.toString().slice(-4)}</h3>
                        <p style="color: #666; font-size: 14px;">${order.createdAt}</p>
                    </div>
                    <span class="${statusClass[order.status]}">
                        ${statusText[order.status]}
                    </span>
                </div>
                <div style="margin-top: 10px;">
                    ${order.items.map(item => `
                        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f1f2f6;">
                            <span>${item.emoji} ${item.name} × ${item.quantity}</span>
                            ${item.note ? `<span style="color: #888; font-size: 12px;">${item.note}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 10px; font-size: 14px; color: #666;">
                    最后更新：${order.updatedAt}
                </div>
            </div>
        `;
    }).join('');
}

// 加载后厨界面
function loadKitchen() {
    const container = document.getElementById('kitchen-orders');
    const waitingOrders = orders.filter(order => order.status !== 'done');
    const completedToday = orders.filter(order => order.status === 'done').length;
    
    document.getElementById('today-completed').textContent = completedToday;
    document.getElementById('waiting-count').textContent = waitingOrders.length;
    
    if (waitingOrders.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 60px; margin-bottom: 20px;">👨‍🍳</div>
                <h3>暂时没有待制作的订单</h3>
                <p>休息一下吧！</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = waitingOrders.map(order => {
        const actionButton = order.status === 'waiting' ? 
            `<button class="btn" style="background: #1e90ff; color: white;" onclick="startCooking(${order.id})">
                <i class="fas fa-play"></i> 开始制作
            </button>` :
            `<button class="btn" style="background: #2ed573; color: white;" onclick="finishCooking(${order.id})">
                <i class="fas fa-check"></i> 制作完成
            </button>`;
        
        return `
            <div class="order-card">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h3>订单 #${order.id.toString().slice(-4)}</h3>
                        <p style="color: #666; font-size: 14px;">下单时间：${order.createdAt}</p>
                    </div>
                    <span class="${order.status === 'waiting' ? 'status-waiting' : 'status-cooking'}">
                        ${order.status === 'waiting' ? '等待制作' : '制作中'}
                    </span>
                </div>
                <div style="margin-top: 10px;">
                    ${order.items.map(item => `
                        <div style="padding: 8px 0; border-bottom: 1px solid #f1f2f6;">
                            <div style="display: flex; justify-content: space-between;">
                                <span><strong>${item.emoji} ${item.name} × ${item.quantity}</strong></span>
                                <span>⏰ ${item.time}分钟</span>
                            </div>
                            ${item.note ? `<div style="color: #ff6b8b; font-size: 14px; margin-top: 5px;"><i class="fas fa-comment"></i> ${item.note}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    ${actionButton}
                    <button class="btn" style="background: #f1f2f6;" onclick="viewOrderDetails(${order.id})">
                        <i class="fas fa-info-circle"></i> 详情
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 开始制作
function startCooking(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'cooking';
        order.updatedAt = new Date().toLocaleString();
        saveOrders();
        loadKitchen();
        loadOrders();
        showNotification("开始制作！加油哦！👨‍🍳");
    }
}

// 完成制作
function finishCooking(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'done';
        order.updatedAt = new Date().toLocaleString();
        saveOrders();
        loadKitchen();
        loadOrders();
        showNotification("太棒了！菜品已完成！🎉");
        
        // 发送完成通知（模拟）
        setTimeout(() => {
            if (Math.random() > 0.5) { // 50%几率获得好评
                showNotification("💖 对方给了你一个五星好评！");
            }
        }, 1000);
    }
}

// 查看订单详情
function viewOrderDetails(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    document.getElementById('modal-title').textContent = `订单 #${order.id.toString().slice(-4)} 详情`;
    document.getElementById('modal-body').innerHTML = `
        <div style="margin-bottom: 15px;">
            <p><strong>状态：</strong> ${order.status === 'waiting' ? '等待制作' : order.status === 'cooking' ? '制作中' : '已完成'}</p>
            <p><strong>下单时间：</strong> ${order.createdAt}</p>
            <p><strong>最后更新：</strong> ${order.updatedAt}</p>
        </div>
        <h4>菜品清单：</h4>
        ${order.items.map(item => `
            <div style="background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 5px;">
                <div style="display: flex; justify-content: space-between;">
                    <span><strong>${item.emoji} ${item.name} × ${item.quantity}</strong></span>
                    <span>${item.time}分钟</span>
                </div>
                ${item.note ? `<p style="margin: 5px 0 0 0; color: #666;"><i>备注：${item.note}</i></p>` : ''}
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #888;">难度：${item.difficulty}</p>
            </div>
        `).join('')}
    `;
    document.getElementById('order-modal').style.display = 'block';
}

// 关闭弹窗
function closeModal() {
    document.getElementById('order-modal').style.display = 'none';
}

// 刷新订单
function refreshOrders() {
    loadOrders();
    showNotification("订单列表已刷新！");
}

// 显示通知
function showNotification(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 更新购物车数量显示
function updateCartCount() {
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').textContent = total;
}

// 数据存储函数
function saveCart() {
    localStorage.setItem('kitchenCart', JSON.stringify(cart));
}

function loadCart() {
    const saved = localStorage.getItem('kitchenCart');
    cart = saved ? JSON.parse(saved) : [];
}

function saveOrders() {
    localStorage.setItem('kitchenOrders', JSON.stringify(orders));
}

function loadOrders() {
    const saved = localStorage.getItem('kitchenOrders');
    orders = saved ? JSON.parse(saved) : [];
}

// 过滤菜品
function filterDishes(category) {
    // 更新分类按钮状态
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const container = document.getElementById('dish-list');
    const filteredDishes = category === 'all' ? 
        dishData : dishData.filter(dish => dish.category === category);
    
    container.innerHTML = filteredDishes.map(dish => `
        <div class="dish-card" onclick="addToCart(${dish.id})">
            <div class="dish-image">
                <span style="font-size: 48px;">${dish.emoji}</span>
            </div>
            <div class="dish-name">${dish.name}</div>
            <div class="dish-time">⏰ ${dish.time}分钟 | ${dish.difficulty}</div>
            <button class="btn" style="background: #ff6b8b; color: white; padding: 8px 16px; margin-top: 10px;">
                加入清单
            </button>
        </div>
    `).join('');
}

// 请求通知权限
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// 点击其他地方关闭弹窗
window.onclick = function(event) {
    const modal = document.getElementById('order-modal');
    if (event.target === modal) {
        closeModal();
    }
};
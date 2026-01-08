let dishData = [];
let cart = [];
let orders = [];

document.addEventListener('DOMContentLoaded', () => initApp());

async function initApp() {
    await loadDishesFromServer();
    cart = JSON.parse(localStorage.getItem('kitchenCart') || '[]');
    if (document.getElementById('orders-list')) await loadOrders();
    updateCartCount();
}

// 1. 计算菜品平均分
function getAverageRating(dishName) {
    const relevantOrders = orders.filter(o => 
        o.rating > 0 && o.items.some(item => item.name === dishName)
    );
    if (relevantOrders.length === 0) return "暂无评分";
    const sum = relevantOrders.reduce((s, o) => s + o.rating, 0);
    return `⭐ ${(sum / relevantOrders.length).toFixed(1)}`;
}

// 2. 渲染菜单（带平均分展示）
function renderDishes(data) {
    const container = document.getElementById('dish-list');
    if(!container) return;
    container.innerHTML = data.map(dish => `
        <div class="dish-card" onclick="addToCart('${dish._id}')">
            <div class="dish-image"><span style="font-size:48px;">${dish.emoji}</span></div>
            <div class="dish-name">${dish.name}</div>
            <div style="font-size:12px; color:#ff9f43;">${getAverageRating(dish.name)}</div>
            <div class="dish-time">⏰ ${dish.time}min</div>
        </div>
    `).join('');
}

// 3. 提交评分
async function submitRating(orderId, score) {
    await fetch(`/api/order/${orderId}/rate`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ rating: score })
    });
    showNotification("评价成功，么么哒！💖");
    loadOrders();
}

// 4. 渲染订单（带评分按钮）
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
                <div style="margin-top:10px; border-top:1px dashed #ddd; padding-top:10px;">
                    <p>好不好吃？给个评价：</p>
                    <div class="rating-btns">
                        ${[1,2,3,4,5].map(num => `<button class="btn-small" onclick="submitRating('${order._id}', ${num})">${num}⭐</button>`).join('')}
                    </div>
                </div>
            ` : order.rating > 0 ? `<div style="color:#ff9f43; margin-top:5px;">已评：${order.rating} ⭐</div>` : ''}
        </div>
    `).join('');
}

// --- 其余功能 (addToCart, addDish, deleteDish, loadKitchen, updateOrderStatus 等) 保持上一版不变 ---
// 注意：在 loadKitchen 渲染时，也可以把 order.rating 显示出来，让大厨看到反馈。
// ...

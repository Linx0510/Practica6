document.addEventListener('DOMContentLoaded', function() {
    // Добавление в корзину
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function() {
            const subjectId = this.dataset.subjectId;
            addToCart(subjectId);
        });
    });

    // Управление количеством в корзине
    document.querySelectorAll('.quantity-increase').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('.quantity-input');
            input.value = parseInt(input.value) + 1;
            updateCartItem(input);
        });
    });

    document.querySelectorAll('.quantity-decrease').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('.quantity-input');
            if (parseInt(input.value) > 1) {
                input.value = parseInt(input.value) - 1;
                updateCartItem(input);
            }
        });
    });

    document.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', function() {
            updateCartItem(this);
        });
    });

    // Удаление из корзины
    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', function() {
            const item = this.closest('.cart-item');
            const subjectId = item.dataset.subjectId;
            removeFromCart(subjectId, item);
        });
    });

    // Оформление заказа
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            alert('Запись оформлена! С вами свяжется администратор для подтверждения.');
            // Очищаем корзину после оформления
            fetch('/cart/clear', { method: 'POST' })
                .then(() => {
                    window.location.href = '/catalog';
                });
        });
    }
});

function addToCart(subjectId) {
    fetch('/cart/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `subjectId=${subjectId}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateCartBadge(data.cartCount);
            showAlert('Предмет добавлен в корзину!', 'success');
        } else {
            showAlert('Ошибка при добавлении в корзину: ' + data.error, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Ошибка при добавлении в корзину', 'danger');
    });
}

function updateCartItem(input) {
    const item = input.closest('.cart-item');
    const subjectId = item.dataset.subjectId;
    const quantity = parseInt(input.value);

    fetch('/cart/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `subjectId=${subjectId}&quantity=${quantity}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateCartBadge(data.cartCount);
            location.reload(); // Простой способ обновить итоги
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Ошибка при обновлении корзины', 'danger');
    });
}

function removeFromCart(subjectId, itemElement) {
    fetch('/cart/remove', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `subjectId=${subjectId}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            itemElement.classList.add('removing');
            setTimeout(() => {
                itemElement.remove();
                updateCartBadge(data.cartCount);
                if (document.querySelectorAll('.cart-item').length === 0) {
                    location.reload();
                } else {
                    location.reload(); // Для пересчета итогов
                }
            }, 300);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Ошибка при удалении из корзины', 'danger');
    });
}

function updateCartBadge(count) {
    const badge = document.querySelector('.nav-link[href="/cart"] .badge');
    if (badge) {
        badge.textContent = count;
        if (count === 0) {
            badge.remove();
        }
    } else if (count > 0) {
        const cartLink = document.querySelector('.nav-link[href="/cart"]');
        if (cartLink) {
            cartLink.innerHTML = 'Корзина <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">' + count + '</span>';
        }
    }
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
    }
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 3000);
}
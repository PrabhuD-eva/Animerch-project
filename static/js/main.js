// Global variables
let cartCount = 0;

// Initialize on document ready
$(document).ready(function() {
    // Update cart count on page load
    updateCartCount();
    
    // Initialize search suggestions
    initSearchSuggestions();
    
    // Initialize add to cart buttons
    initAddToCart();
    
    // Initialize animations
    initAnimations();
    
    // Initialize tooltips
    initTooltips();
});

// Update cart count
function updateCartCount() {
    $.get('/api/cart/count/', function(data) {
        $('.cart-count').text(data.count);
    }).fail(function() {
        console.log('Failed to update cart count');
    });
}

// Search suggestions
function initSearchSuggestions() {
    let searchTimeout;
    
    $('#searchInput').on('input', function() {
        clearTimeout(searchTimeout);
        const query = $(this).val();
        
        if (query.length < 2) {
            $('#searchSuggestions').hide();
            return;
        }
        
        searchTimeout = setTimeout(function() {
            $.get('/search/suggestions/', { q: query }, function(data) {
                if (data.suggestions.length > 0) {
                    let html = '';
                    data.suggestions.forEach(function(item) {
                        html += `<div class="suggestion-item" data-id="${item.id}">
                            <strong>${item.name}</strong><br>
                            <small>₹${item.price}</small>
                        </div>`;
                    });
                    $('#searchSuggestions').html(html).show();
                } else {
                    $('#searchSuggestions').hide();
                }
            });
        }, 300);
    });
    
    $(document).on('click', '.suggestion-item', function() {
        const id = $(this).data('id');
        window.location.href = `/product/${id}/`;
    });
    
    $(document).click(function(e) {
        if (!$(e.target).closest('#searchForm').length) {
            $('#searchSuggestions').hide();
        }
    });
}

// Add to cart functionality
function initAddToCart() {
    $('.add-to-cart').click(function(e) {
        e.preventDefault();
        const button = $(this);
        const productId = button.data('product-id');
        const quantity = button.data('quantity') || 1;
        
        // Show loading state
        button.html('<div class="spinner"></div>').prop('disabled', true);
        
        $.post('/cart/add/', {
            product_id: productId,
            quantity: quantity,
            csrfmiddlewaretoken: getCookie('csrftoken')
        }, function(data) {
            if (data.success) {
                showNotification('Product added to cart!', 'success');
                $('.cart-count').text(data.cart_total);
                
                // Animate cart icon
                animateCartIcon();
            } else {
                showNotification('Failed to add product to cart', 'error');
            }
        }).fail(function() {
            showNotification('An error occurred', 'error');
        }).always(function() {
            // Restore button
            button.html('<i class="fas fa-cart-plus"></i>').prop('disabled', false);
        });
    });
}

// Cart quantity update
function updateCartItem(itemId, quantity) {
    $.post('/cart/update/', {
        item_id: itemId,
        quantity: quantity,
        csrfmiddlewaretoken: getCookie('csrftoken')
    }, function(data) {
        if (data.success) {
            // Update item subtotal
            $(`#item-${itemId} .item-subtotal`).text(`₹${data.item_subtotal}`);
            
            // Update cart total
            $('.cart-total').text(`₹${data.cart_total}`);
            
            // Update cart count
            $('.cart-count').text(data.item_count);
            
            showNotification('Cart updated', 'success');
        }
    });
}

// Remove from cart
function removeFromCart(itemId) {
    if (confirm('Remove this item from cart?')) {
        $.post('/cart/remove/', {
            item_id: itemId,
            csrfmiddlewaretoken: getCookie('csrftoken')
        }, function(data) {
            if (data.success) {
                $(`#item-${itemId}`).fadeOut(300, function() {
                    $(this).remove();
                    
                    // Update cart total and count
                    $('.cart-total').text(`₹${data.cart_total}`);
                    $('.cart-count').text(data.item_count);
                    
                    // If cart is empty, show empty cart message
                    if ($('.cart-item').length === 0) {
                        location.reload();
                    }
                });
                
                showNotification('Item removed from cart', 'success');
            }
        });
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = $(`
        <div class="toast-notification ${type}">
            <div class="d-flex align-items-center">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-3 fa-2x"></i>
                <div>
                    <strong>${type === 'success' ? 'Success!' : 'Error!'}</strong>
                    <p class="mb-0">${message}</p>
                </div>
            </div>
        </div>
    `);
    
    $('body').append(notification);
    
    setTimeout(function() {
        notification.fadeOut(300, function() {
            $(this).remove();
        });
    }, 3000);
}

// Animate cart icon
function animateCartIcon() {
    $('.fa-shopping-cart').parent().addClass('pulse');
    setTimeout(function() {
        $('.fa-shopping-cart').parent().removeClass('pulse');
    }, 1000);
}

// Get CSRF token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Initialize animations
function initAnimations() {
    // Anime.js animations for hero section
    if (typeof anime !== 'undefined') {
        // Animate floating characters
        anime({
            targets: '.floating-characters i',
            translateY: [
                { value: -20, duration: 1500 },
                { value: 0, duration: 1500 }
            ],
            loop: true,
            easing: 'easeInOutQuad'
        });
        
        // Animate section titles on scroll
        anime({
            targets: '.section-title',
            opacity: [0, 1],
            translateY: [50, 0],
            delay: anime.stagger(200),
            easing: 'easeOutQuad',
            autoplay: false
        });
    }
    
    // Scroll animations
    $(window).scroll(function() {
        $('.fade-in').each(function() {
            const elementTop = $(this).offset().top;
            const elementBottom = elementTop + $(this).outerHeight();
            const viewportTop = $(window).scrollTop();
            const viewportBottom = viewportTop + $(window).height();
            
            if (elementBottom > viewportTop && elementTop < viewportBottom) {
                $(this).addClass('visible');
            }
        });
    });
}

// Initialize tooltips
function initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Quantity input handlers
$(document).on('change', '.quantity-input', function() {
    const itemId = $(this).data('item-id');
    const quantity = parseInt($(this).val());
    
    if (quantity > 0) {
        updateCartItem(itemId, quantity);
    } else {
        $(this).val(1);
    }
});

// Remove from cart buttons
$(document).on('click', '.remove-from-cart', function() {
    const itemId = $(this).data('item-id');
    removeFromCart(itemId);
});

// Product image gallery
$(document).on('click', '.thumbnail', function() {
    const imageUrl = $(this).data('image');
    $('.main-image img').attr('src', imageUrl);
    $('.thumbnail').removeClass('active');
    $(this).addClass('active');
});

// Add CSS class for fade animations
$('<style>')
    .prop('type', 'text/css')
    .html(`
        .fade-in {
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.6s ease-out;
        }
        
        .fade-in.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        .pulse {
            animation: pulse 0.5s ease-in-out;
        }
    `)
    .appendTo('head');
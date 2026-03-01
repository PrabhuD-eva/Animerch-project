// Global variables
let cartCount = 0;

// Document ready
$(document).ready(function() {
    console.log('Anime Merch Store loaded!');
    
    // Initialize everything
    initNavbarScroll();
    initSearch();
    initCart();
    initAnimations();
    initTooltips();
    initFloatingElements();
});

// Navbar scroll effect
function initNavbarScroll() {
    $(window).scroll(function() {
        if ($(this).scrollTop() > 50) {
            $('.navbar').addClass('scrolled');
        } else {
            $('.navbar').removeClass('scrolled');
        }
    });
}

// Search functionality
function initSearch() {
    let searchTimeout;
    
    $('#searchInput').on('input', function() {
        clearTimeout(searchTimeout);
        const query = $(this).val().trim();
        
        if (query.length < 2) {
            $('#searchSuggestions').fadeOut();
            return;
        }
        
        searchTimeout = setTimeout(function() {
            $.ajax({
                url: '/search/suggestions/',
                data: { q: query },
                success: function(data) {
                    if (data.suggestions && data.suggestions.length > 0) {
                        displaySuggestions(data.suggestions);
                    } else {
                        $('#searchSuggestions').fadeOut();
                    }
                },
                error: function() {
                    console.log('Search error');
                }
            });
        }, 300);
    });
    
    // Close suggestions when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#searchForm').length) {
            $('#searchSuggestions').fadeOut();
        }
    });
}

function displaySuggestions(suggestions) {
    let html = '';
    suggestions.forEach(function(item) {
        html += `
            <div class="suggestion-item" data-id="${item.id}">
                <div class="d-flex align-items-center">
                    <i class="fas fa-search me-2"></i>
                    <div>
                        <strong>${item.name}</strong>
                        <br>
                        <small class="text-muted">₹${item.price}</small>
                    </div>
                </div>
            </div>
        `;
    });
    
    $('#searchSuggestions').html(html).fadeIn();
    
    // Handle suggestion click
    $('.suggestion-item').click(function() {
        const id = $(this).data('id');
        window.location.href = `/product/${id}/`;
    });
}

// Cart functionality
function initCart() {
    updateCartCount();
    
    // Add to cart
    $(document).on('click', '.add-to-cart', function(e) {
        e.preventDefault();
        const button = $(this);
        const productId = button.data('product-id');
        const quantity = button.data('quantity') || 1;
        
        // Show loading state
        const originalHtml = button.html();
        button.html('<div class="spinner"></div>').prop('disabled', true);
        
        $.ajax({
            url: '/cart/add/',
            method: 'POST',
            data: {
                product_id: productId,
                quantity: quantity,
                csrfmiddlewaretoken: getCookie('csrftoken')
            },
            success: function(data) {
                if (data.success) {
                    updateCartCount();
                    showNotification('Product added to cart!', 'success');
                    animateCartIcon();
                } else {
                    showNotification('Failed to add product', 'error');
                }
            },
            error: function() {
                showNotification('An error occurred', 'error');
            },
            complete: function() {
                button.html(originalHtml).prop('disabled', false);
            }
        });
    });
}

function updateCartCount() {
    $.ajax({
        url: '/cart/count/',
        method: 'GET',
        success: function(data) {
            $('.cart-count').text(data.count);
            cartCount = data.count;
            
            // Animate if count changed
            if (data.count > 0) {
                $('.cart-count').addClass('pulse');
                setTimeout(() => {
                    $('.cart-count').removeClass('pulse');
                }, 1000);
            }
        },
        error: function() {
            $('.cart-count').text('0');
        }
    });
}

function animateCartIcon() {
    $('.fa-shopping-cart').parent().addClass('animate__animated animate__pulse');
    setTimeout(() => {
        $('.fa-shopping-cart').parent().removeClass('animate__animated animate__pulse');
    }, 1000);
}

// Notification system
function showNotification(message, type = 'info') {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#667eea'
    };
    
    const notification = $(`
        <div class="toast-notification ${type}">
            <div class="d-flex align-items-center">
                <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 2rem; margin-right: 15px;"></i>
                <div>
                    <strong>${type.charAt(0).toUpperCase() + type.slice(1)}!</strong>
                    <p class="mb-0" style="color: #666;">${message}</p>
                </div>
                <button class="btn-close ms-3" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
            <div class="progress" style="height: 3px; margin-top: 10px;">
                <div class="progress-bar" style="width: 100%; background: ${colors[type]}; animation: progressBar 3s linear;"></div>
            </div>
        </div>
    `);
    
    $('body').append(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.fadeOut(300, function() {
            $(this).remove();
        });
    }, 3000);
}

// Add progress bar animation
$('<style>')
    .prop('type', 'text/css')
    .html(`
        @keyframes progressBar {
            from { width: 100%; }
            to { width: 0%; }
        }
    `)
    .appendTo('head');

// Animations
function initAnimations() {
    // Animate elements when they come into view
    const animateOnScroll = function() {
        $('.animate-on-scroll').each(function() {
            const elementTop = $(this).offset().top;
            const elementBottom = elementTop + $(this).outerHeight();
            const viewportTop = $(window).scrollTop();
            const viewportBottom = viewportTop + $(window).height();
            
            if (elementBottom > viewportTop && elementTop < viewportBottom) {
                $(this).addClass('animated');
            }
        });
    };
    
    $(window).on('scroll', animateOnScroll);
    animateOnScroll(); // Run once on load
}

// Tooltips
function initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Floating elements
function initFloatingElements() {
    // Create floating elements
    const icons = ['fa-dragon', 'fa-crown', 'fa-mask', 'fa-star', 'fa-heart', 'fa-gem'];
    
    for (let i = 0; i < 6; i++) {
        const icon = icons[Math.floor(Math.random() * icons.length)];
        const size = Math.floor(Math.random() * 3) + 2; // 2-4rem
        const duration = Math.floor(Math.random() * 5) + 3; // 3-7s
        const delay = Math.floor(Math.random() * 5); // 0-4s
        const top = Math.floor(Math.random() * 100); // 0-100%
        const left = Math.floor(Math.random() * 100); // 0-100%
        
        const element = $(`
            <i class="fas ${icon} floating-element" 
               style="font-size: ${size}rem; top: ${top}%; left: ${left}%; animation-duration: ${duration}s; animation-delay: ${delay}s;">
            </i>
        `);
        
        $('body').append(element);
    }
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

// Quantity input handlers
$(document).on('click', '.quantity-plus', function() {
    const input = $(this).closest('.input-group').find('.quantity-input');
    const currentVal = parseInt(input.val());
    const max = parseInt(input.attr('max')) || 999;
    
    if (currentVal < max) {
        input.val(currentVal + 1).trigger('change');
    }
});

$(document).on('click', '.quantity-minus', function() {
    const input = $(this).closest('.input-group').find('.quantity-input');
    const currentVal = parseInt(input.val());
    
    if (currentVal > 1) {
        input.val(currentVal - 1).trigger('change');
    }
});

// Image gallery
$(document).on('click', '.thumbnail', function() {
    const imageUrl = $(this).data('image');
    $('.main-image img').attr('src', imageUrl);
    $('.thumbnail').removeClass('active');
    $(this).addClass('active');
});

// Product quick view
function quickView(productId) {
    $.ajax({
        url: `/product/${productId}/quick-view/`,
        method: 'GET',
        success: function(data) {
            // Create and show modal
            const modal = $(`
                <div class="modal fade" id="quickViewModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${data.name}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                ${data.description}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary add-to-cart" data-product-id="${productId}">
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `);
            
            $('body').append(modal);
            modal.modal('show');
            
            modal.on('hidden.bs.modal', function() {
                modal.remove();
            });
        }
    });
}

// Add to wishlist
$(document).on('click', '.add-to-wishlist', function() {
    const productId = $(this).data('product-id');
    
    $.ajax({
        url: '/wishlist/add/',
        method: 'POST',
        data: {
            product_id: productId,
            csrfmiddlewaretoken: getCookie('csrftoken')
        },
        success: function(data) {
            if (data.success) {
                showNotification('Added to wishlist!', 'success');
            }
        }
    });
});

// Price range filter
$('#priceRange').on('input', function() {
    const value = $(this).val();
    $('#priceValue').text('₹' + value);
    
    // Filter products
    $('.product-card').each(function() {
        const price = parseFloat($(this).data('price'));
        if (price <= value) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
});

// Sort products
$('#sortSelect').change(function() {
    const sortBy = $(this).val();
    const products = $('.product-card');
    
    products.sort(function(a, b) {
        const aVal = $(a).data(sortBy);
        const bVal = $(b).data(sortBy);
        
        if (sortBy === 'price') {
            return aVal - bVal;
        } else {
            return aVal.localeCompare(bVal);
        }
    });
    
    $('.products-grid').html(products);
});

// Lazy load images
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver(function(entries, observer) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                imageObserver.unobserve(img);
            }
        });
    });
    
    $('img[data-src]').each(function() {
        imageObserver.observe(this);
    });
}

// Back to top button
$(window).scroll(function() {
    if ($(this).scrollTop() > 500) {
        $('#backToTop').fadeIn();
    } else {
        $('#backToTop').fadeOut();
    }
});

$('#backToTop').click(function() {
    $('html, body').animate({ scrollTop: 0 }, 500);
});

// Add back to top button
$('body').append(`
    <button id="backToTop" class="btn btn-primary" style="position: fixed; bottom: 20px; right: 20px; display: none; z-index: 1000; border-radius: 50%; width: 50px; height: 50px; padding: 0;">
        <i class="fas fa-arrow-up"></i>
    </button>
`);

// Initialize on page load
console.log('Anime Merch Store - JavaScript initialized!');
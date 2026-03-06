from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_POST
from .models import Product, Category, Cart, CartItem, Order, OrderItem, ContactMessage, UserProfile
from django.contrib.auth.models import User
import uuid
import json

# ================ HELPER FUNCTIONS ================

def get_or_create_cart(request):
    """Get existing cart or create a new one"""
    if request.user.is_authenticated:
        cart, created = Cart.objects.get_or_create(user=request.user)
    else:
        session_id = request.session.get('cart_id')
        if not session_id:
            session_id = str(uuid.uuid4())
            request.session['cart_id'] = session_id
        cart, created = Cart.objects.get_or_create(session_id=session_id)
    return cart

# ================ PUBLIC PAGES ================

def index(request):
    """Home page"""
    featured_products = Product.objects.filter(featured=True)[:8]
    latest_products = Product.objects.order_by('-created_at')[:8]
    categories = Category.objects.all()
    
    context = {
        'featured_products': featured_products,
        'latest_products': latest_products,
        'categories': categories,
    }
    return render(request, 'store/index.html', context)

def product_list(request):
    """Product listing page"""
    products = Product.objects.all()
    categories = Category.objects.all()
    
    # Filter by category
    category = request.GET.get('category')
    if category:
        products = products.filter(category=category)
    
    # Search
    search = request.GET.get('search')
    if search:
        products = products.filter(name__icontains=search)
    
    # Sort
    sort = request.GET.get('sort', 'name')
    if sort == 'price_low':
        products = products.order_by('price')
    elif sort == 'price_high':
        products = products.order_by('-price')
    elif sort == 'newest':
        products = products.order_by('-created_at')
    else:
        products = products.order_by('name')
    
    context = {
        'products': products,
        'categories': categories,
        'current_category': category,
        'current_sort': sort,
    }
    return render(request, 'store/products.html', context)

def product_detail(request, id):
    """Product detail page"""
    product = get_object_or_404(Product, id=id)
    related_products = Product.objects.filter(category=product.category).exclude(id=id)[:4]
    
    context = {
        'product': product,
        'related_products': related_products,
    }
    return render(request, 'store/product_detail.html', context)

def about(request):
    """About Us page"""
    return render(request, 'store/about.html')

def contact(request):
    """Contact Us page"""
    if request.method == 'POST':
        name = request.POST.get('name')
        email = request.POST.get('email')
        message = request.POST.get('message')
        
        # Save to database
        ContactMessage.objects.create(
            name=name,
            email=email,
            message=message
        )
        
        messages.success(request, 'Thank you for contacting us! We will reply soon.')
        return redirect('contact')
    
    return render(request, 'store/contact.html')

# ================ CART OPERATIONS ================

def cart_view(request):
    """View cart"""
    cart = get_or_create_cart(request)
    cart_items = CartItem.objects.filter(cart=cart).select_related('product')
    total = cart.get_total()
    
    context = {
        'cart_items': cart_items,
        'total': total,
    }
    return render(request, 'store/cart.html', context)

def add_to_cart(request, product_id):
    """Add item to cart"""
    product = get_object_or_404(Product, id=product_id)
    
    # Check stock
    if product.stock <= 0:
        messages.error(request, 'Sorry, this product is out of stock!')
        return redirect('product_detail', id=product_id)
    
    cart = get_or_create_cart(request)
    
    # Check if item already in cart
    cart_item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product,
        defaults={'quantity': 0}
    )
    
    # Update quantity
    if cart_item.quantity + 1 > product.stock:
        messages.error(request, f'Sorry, only {product.stock} items available!')
        return redirect('cart')
    
    cart_item.quantity += 1
    cart_item.save()
    
    messages.success(request, f'{product.name} added to cart!')
    
    # For AJAX requests
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({
            'success': True,
            'cart_count': CartItem.objects.filter(cart=cart).count(),
            'message': f'{product.name} added to cart!'
        })
    
    return redirect('cart')

def update_cart(request, item_id):
    """Update cart item quantity"""
    cart_item = get_object_or_404(CartItem, id=item_id)
    
    if request.method == 'POST':
        quantity = int(request.POST.get('quantity', 1))
        
        if quantity > 0:
            # Check stock
            if quantity > cart_item.product.stock:
                messages.error(request, f'Sorry, only {cart_item.product.stock} items available!')
            else:
                cart_item.quantity = quantity
                cart_item.save()
                messages.success(request, 'Cart updated!')
        else:
            # Remove if quantity is 0
            cart_item.delete()
            messages.success(request, 'Item removed from cart!')
    
    return redirect('cart')

def remove_from_cart(request, item_id):
    """Remove item from cart"""
    cart_item = get_object_or_404(CartItem, id=item_id)
    product_name = cart_item.product.name
    cart_item.delete()
    messages.success(request, f'{product_name} removed from cart!')
    return redirect('cart')

def cart_count(request):
    """Get cart count for AJAX"""
    cart = get_or_create_cart(request)
    count = CartItem.objects.filter(cart=cart).count()
    return JsonResponse({'count': count})

# ================ CHECKOUT & ORDERS ================

@login_required
def checkout(request):
    """Checkout page"""
    cart = get_or_create_cart(request)
    cart_items = CartItem.objects.filter(cart=cart)
    
    if not cart_items:
        messages.warning(request, 'Your cart is empty!')
        return redirect('products')
    
    total = cart.get_total()
    
    if request.method == 'POST':
        # Create order
        order = Order.objects.create(
            user=request.user,
            full_name=request.POST.get('full_name'),
            email=request.POST.get('email'),
            address=request.POST.get('address'),
            city=request.POST.get('city'),
            state=request.POST.get('state'),
            zip_code=request.POST.get('zip_code'),
            phone=request.POST.get('phone'),
            total_amount=total,
        )
        
        # Create order items and update stock
        for item in cart_items:
            OrderItem.objects.create(
                order=order,
                product=item.product,
                quantity=item.quantity,
                price=item.product.price
            )
            
            # Update product stock
            product = item.product
            product.stock -= item.quantity
            product.save()
        
        # Clear cart
        cart_items.delete()
        
        messages.success(request, 'Order placed successfully!')
        return redirect('order_confirmation', order_id=order.id)
    
    context = {
        'cart_items': cart_items,
        'total': total,
    }
    return render(request, 'store/checkout.html', context)

@login_required
def order_confirmation(request, order_id):
    """Order confirmation page"""
    order = get_object_or_404(Order, id=order_id, user=request.user)
    return render(request, 'store/order_confirmation.html', {'order': order})

@login_required
def order_history(request):
    """Order history page"""
    orders = Order.objects.filter(user=request.user).order_by('-created_at')
    return render(request, 'store/orders.html', {'orders': orders})

# ================ AUTHENTICATION ================

def register(request):
    """User registration"""
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')
        
        # Validation
        if password != confirm_password:
            messages.error(request, 'Passwords do not match!')
            return redirect('register')
        
        if User.objects.filter(username=username).exists():
            messages.error(request, 'Username already exists!')
            return redirect('register')
        
        if User.objects.filter(email=email).exists():
            messages.error(request, 'Email already registered!')
            return redirect('register')
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )
        
        # Transfer guest cart to user if exists
        session_id = request.session.get('cart_id')
        if session_id:
            try:
                guest_cart = Cart.objects.get(session_id=session_id)
                guest_cart.user = user
                guest_cart.session_id = None
                guest_cart.save()
            except Cart.DoesNotExist:
                pass
        
        login(request, user)
        messages.success(request, 'Registration successful!')
        return redirect('index')
    
    return render(request, 'store/register.html')

def login_view(request):
    """User login"""
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            
            # Transfer guest cart to user if exists
            session_id = request.session.get('cart_id')
            if session_id:
                try:
                    guest_cart = Cart.objects.get(session_id=session_id)
                    # Check if user already has a cart
                    user_cart, created = Cart.objects.get_or_create(user=user)
                    
                    # Move items from guest cart to user cart
                    for item in guest_cart.cartitem_set.all():
                        user_item, created = CartItem.objects.get_or_create(
                            cart=user_cart,
                            product=item.product,
                            defaults={'quantity': 0}
                        )
                        user_item.quantity += item.quantity
                        user_item.save()
                    
                    # Delete guest cart
                    guest_cart.delete()
                    
                except Cart.DoesNotExist:
                    pass
            
            messages.success(request, f'Welcome back, {username}!')
            
            # Redirect to next page if exists
            next_url = request.GET.get('next')
            if next_url:
                return redirect(next_url)
            return redirect('index')
        else:
            messages.error(request, 'Invalid username or password!')
    
    return render(request, 'store/login.html')

def logout_view(request):
    """User logout"""
    logout(request)
    messages.success(request, 'You have been logged out!')
    return redirect('index')

@login_required
def profile(request):
    """User profile page"""
    return render(request, 'store/profile.html')

@login_required
def profile(request):
    """User profile page"""
    if request.method == 'POST':
        # Update user info
        user = request.user
        user.email = request.POST.get('email', user.email)
        user.first_name = request.POST.get('first_name', user.first_name)
        user.last_name = request.POST.get('last_name', user.last_name)
        user.save()
        
        messages.success(request, 'Profile updated successfully!')
        return redirect('profile')
    
    return render(request, 'store/profile.html')
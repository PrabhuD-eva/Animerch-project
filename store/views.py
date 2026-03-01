from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import Product, Category, Anime, Cart, CartItem, Order
from .forms import CheckoutForm
import json
from decimal import Decimal
import uuid

def get_or_create_cart(request):
    if request.user.is_authenticated:
        cart, created = Cart.objects.get_or_create(user=request.user)
    else:
        session_id = request.session.get('cart_session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
            request.session['cart_session_id'] = session_id
        cart, created = Cart.objects.get_or_create(session_id=session_id, user=None)
    return cart

def index(request):
    featured_products = Product.objects.filter(featured=True)[:8]
    categories = Category.objects.all()
    anime_list = Anime.objects.all()
    latest_products = Product.objects.order_by('-created_at')[:12]
    
    context = {
        'featured_products': featured_products,
        'categories': categories,
        'anime_list': anime_list,
        'latest_products': latest_products,
    }
    return render(request, 'store/index.html', context)

def product_list(request):
    products = Product.objects.all()
    categories = Category.objects.all()
    anime_list = Anime.objects.all()
    
    # Filter by category
    category_slug = request.GET.get('category')
    if category_slug:
        products = products.filter(category__slug=category_slug)
    
    # Filter by anime
    anime_slug = request.GET.get('anime')
    if anime_slug:
        products = products.filter(anime__slug=anime_slug)
    
    # Filter by product type
    product_type = request.GET.get('type')
    if product_type:
        products = products.filter(product_type=product_type)
    
    # Filter by sale
    if request.GET.get('on_sale') == 'true':
        products = products.filter(discount_percent__gt=0)
    
    # Search
    search_query = request.GET.get('search')
    if search_query:
        products = products.filter(name__icontains=search_query) | products.filter(description__icontains=search_query)
    
    # Sort
    sort = request.GET.get('sort', 'name')
    if sort == 'price_low':
        products = products.order_by('price')
    elif sort == 'price_high':
        products = products.order_by('-price')
    elif sort == 'newest':
        products = products.order_by('-created_at')
    elif sort == 'popular':
        products = products.order_by('-id')  # Placeholder for popularity
    else:
        products = products.order_by('name')
    
    context = {
        'products': products,
        'categories': categories,
        'anime_list': anime_list,
        'current_category': category_slug,
        'current_anime': anime_slug,
        'current_sort': sort,
    }
    return render(request, 'store/product_list.html', context)

def product_detail(request, slug):
    product = get_object_or_404(Product, slug=slug)
    related_products = Product.objects.filter(anime=product.anime).exclude(id=product.id)[:4]
    
    context = {
        'product': product,
        'related_products': related_products,
    }
    return render(request, 'store/product_detail.html', context)

@require_POST
def add_to_cart(request):
    product_id = request.POST.get('product_id')
    quantity = int(request.POST.get('quantity', 1))
    
    try:
        product = Product.objects.get(id=product_id)
        cart = get_or_create_cart(request)
        
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={'quantity': 0}
        )
        cart_item.quantity += quantity
        cart_item.save()
        
        messages.success(request, f'{product.name} added to cart!')
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'success': True,
                'cart_total': cart.items.count(),
                'cart_total_price': str(cart.total_with_discount)
            })
        return redirect('cart_detail')
        
    except Product.DoesNotExist:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': 'Product not found'})
        messages.error(request, 'Product not found')
        return redirect('product_list')

def cart_detail(request):
    cart = get_or_create_cart(request)
    context = {
        'cart': cart,
        'cart_items': cart.items.all().select_related('product')
    }
    return render(request, 'store/cart.html', context)

@require_POST
def update_cart_item(request):
    item_id = request.POST.get('item_id')
    quantity = int(request.POST.get('quantity', 1))
    
    try:
        cart_item = CartItem.objects.get(id=item_id)
        if quantity > 0:
            cart_item.quantity = quantity
            cart_item.save()
        else:
            cart_item.delete()
        
        cart = cart_item.cart
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'success': True,
                'item_subtotal': str(cart_item.subtotal_with_discount),
                'cart_total': str(cart.total_with_discount),
                'item_count': cart.items.count()
            })
        return redirect('cart_detail')
        
    except CartItem.DoesNotExist:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': 'Item not found'})
        return redirect('cart_detail')

@require_POST
def remove_from_cart(request):
    item_id = request.POST.get('item_id')
    
    try:
        cart_item = CartItem.objects.get(id=item_id)
        cart_item.delete()
        messages.success(request, 'Item removed from cart')
        
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            cart = get_or_create_cart(request)
            return JsonResponse({
                'success': True,
                'cart_total': str(cart.total_with_discount),
                'item_count': cart.items.count()
            })
        return redirect('cart_detail')
        
    except CartItem.DoesNotExist:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': 'Item not found'})
        return redirect('cart_detail')

@login_required
def checkout(request):
    cart = get_or_create_cart(request)
    
    if cart.items.count() == 0:
        messages.warning(request, 'Your cart is empty')
        return redirect('product_list')
    
    if request.method == 'POST':
        form = CheckoutForm(request.POST)
        if form.is_valid():
            # Create order
            order = Order.objects.create(
                user=request.user,
                cart=cart,
                full_name=form.cleaned_data['full_name'],
                email=form.cleaned_data['email'],
                address=form.cleaned_data['address'],
                city=form.cleaned_data['city'],
                state=form.cleaned_data['state'],
                zip_code=form.cleaned_data['zip_code'],
                country=form.cleaned_data['country'],
                phone=form.cleaned_data['phone'],
                total_amount=cart.total,
                discount_amount=cart.total_discount,
                final_amount=cart.total_with_discount
            )
            
            # Clear cart
            cart.items.all().delete()
            
            messages.success(request, 'Order placed successfully!')
            return redirect('order_confirmation', order_id=order.id)
    else:
        form = CheckoutForm()
    
    context = {
        'cart': cart,
        'form': form
    }
    return render(request, 'store/checkout.html', context)

@login_required
def order_confirmation(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    context = {'order': order}
    return render(request, 'store/order_confirmation.html', context)

def search_suggestions(request):
    query = request.GET.get('q', '')
    if query:
        products = Product.objects.filter(name__icontains=query)[:5]
        suggestions = [{'id': p.id, 'name': p.name, 'price': str(p.price)} for p in products]
        return JsonResponse({'suggestions': suggestions})
    return JsonResponse({'suggestions': []})

def cart_count(request):
    cart = get_or_create_cart(request)
    return JsonResponse({'count': cart.items.count()})

def cart_count(request):
    cart = get_or_create_cart(request)
    return JsonResponse({'count': cart.items.count()})
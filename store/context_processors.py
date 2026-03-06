from .models import Category

def categories_processor(request):
    return {'categories': Category.objects.all()}

# Remove the anime_list_processor since we don't have Anime model anymore
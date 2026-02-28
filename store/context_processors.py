from .models import Category, Anime

def categories_processor(request):
    return {'categories': Category.objects.all()}

def anime_list_processor(request):
    return {'anime_list': Anime.objects.all()}
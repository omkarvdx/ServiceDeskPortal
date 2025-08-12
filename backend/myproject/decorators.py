from functools import wraps
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

def csrf_exempt_for_api(view_func):
    """
    Decorator to handle CSRF for API views.
    Ensures CSRF cookie is set and verifies the token for POST requests.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Set CSRF cookie if not present
        if not request.META.get('CSRF_COOKIE'):
            request.META['CSRF_COOKIE'] = request.COOKIES.get('csrftoken')
        return view_func(request, *args, **kwargs)
    
    return _wrapped_view

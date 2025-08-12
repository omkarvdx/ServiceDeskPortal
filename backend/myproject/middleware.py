from django.middleware.csrf import CsrfViewMiddleware, get_token
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings

class CsrfCookieMiddleware(MiddlewareMixin):
    """
    Middleware to ensure CSRF cookie is set on all responses.
    This helps with API requests from the frontend.
    """
    def process_request(self, request):
        # Ensure CSRF token is set in request.META for API views
        if not request.META.get('CSRF_COOKIE'):
            csrf_token = get_token(request)
            if csrf_token:
                request.META['CSRF_COOKIE'] = csrf_token
        return None

    def process_response(self, request, response):
        # Set CSRF cookie if it's not already set
        if not request.COOKIES.get(settings.CSRF_COOKIE_NAME) and hasattr(request, 'csrf_processing_done'):
            csrf_token = get_token(request)
            if csrf_token:
                response.set_cookie(
                    settings.CSRF_COOKIE_NAME,
                    csrf_token,
                    max_age=60 * 60 * 24 * 7,  # 1 week
                    httponly=False,  # Allow JavaScript to read the cookie
                    samesite='Lax',
                    secure=getattr(settings, 'CSRF_COOKIE_SECURE', False)
                )
        return response

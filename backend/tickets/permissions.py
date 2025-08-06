from rest_framework.permissions import BasePermission

class IsSupportEngineerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['support_engineer', 'admin']

class IsAdminOnly(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'

class CTIPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
            
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return request.user.role in ['support_engineer', 'admin']
        else:
            return request.user.role == 'admin'

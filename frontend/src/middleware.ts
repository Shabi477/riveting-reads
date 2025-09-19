import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Helper function to decode JWT token and get user role
function getUserRole(token: string): string | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const decoded = JSON.parse(jsonPayload);
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return null; // Token expired
    }
    
    return decoded.role || null;
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  const { pathname } = request.nextUrl;
  const userRole = token ? getUserRole(token) : null;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup', '/admin/login'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // Allow specific API routes to handle their own auth
  if (pathname.startsWith('/api/auth/') || 
      pathname.startsWith('/api/books') || 
      pathname.startsWith('/api/words/translate')) {
    return NextResponse.next();
  }
  
  // All other API routes should handle their own auth  
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // If user is not authenticated and trying to access protected route
  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Protect admin routes - only admin users can access
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!token || userRole !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // If user is authenticated and trying to access auth pages, redirect appropriately
  if (token && (pathname === '/login' || pathname === '/signup')) {
    // Redirect admins to admin dashboard, regular users to library
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/library', request.url));
    }
  }
  
  // If admin is authenticated and trying to access admin login, redirect to dashboard
  if (token && pathname === '/admin/login' && userRole === 'admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // If regular user tries to access root path, redirect to library
  if (token && pathname === '/' && userRole === 'user') {
    return NextResponse.redirect(new URL('/library', request.url));
  }

  // If admin user tries to access root path, redirect to admin dashboard
  if (token && pathname === '/' && userRole === 'admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
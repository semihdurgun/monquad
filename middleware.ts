import { NextRequest, NextResponse } from 'next/server';

// Edge Runtime compatible JWT verification
async function verifyAccessTokenEdge(token: string): Promise<any> {
  try {
    // For Edge Runtime, we'll do a simpler check
    // Real verification happens in API routes with Node.js runtime
    
    // Basic JWT structure check
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    // Decode payload (without signature verification in Edge)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

// Define protected routes
const PROTECTED_ROUTES = [
  '/api/update-player',
  '/api/get-player',
  '/api/get-player-game',
  '/api/leaderboard',
  '/api/game', // Tüm game API route'ları
  '/dashboard',
  '/profile',
  '/game', // Oyun sayfası da korumalı olabilir
];

// Define auth routes (no redirect for these)
const AUTH_ROUTES = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
];

// Define public routes (no authentication needed)
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/about',
  '/_next',
  '/favicon.ico',
  '/assets',
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route => pathname.startsWith(route));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Skip middleware for auth routes (except add user info if available)
  if (isAuthRoute(pathname)) {
    return NextResponse.next();
  }

  // Get tokens from cookies
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const userId = request.cookies.get('user_id')?.value;

  // Check if route requires authentication
  if (isProtectedRoute(pathname)) {
    // No access token
    if (!accessToken) {
      
      // For API routes, return 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      // For pages, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify access token
    const tokenPayload = await verifyAccessTokenEdge(accessToken);
    if (!tokenPayload) {
      // Token is invalid, check if we can refresh
      if (refreshToken && userId) {
        console.log(`🔄 Attempting token refresh for user: ${userId}`);
        
        // For API routes, return 401 with refresh instruction
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { 
              error: 'Token expired',
              requiresRefresh: true 
            },
            { status: 401 }
          );
        }
        
        // For pages, redirect to refresh then back
        const refreshUrl = new URL('/api/auth/refresh', request.url);
        return NextResponse.redirect(refreshUrl);
      }

      // No refresh token available
      
      // For API routes, return 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      // For pages, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Token is valid - add user info to request headers for API routes
    if (pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', tokenPayload.userId);
      requestHeaders.set('x-username', tokenPayload.username);
      requestHeaders.set('x-wallet-address', tokenPayload.walletAddress);



      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    // For pages, just continue
    console.log(`✅ Authenticated page request: ${pathname} by ${tokenPayload.username}`);
    return NextResponse.next();
  }

  // Non-protected route with valid token - add user info to headers
  if (accessToken) {
    const tokenPayload = await verifyAccessTokenEdge(accessToken);
    if (tokenPayload && pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', tokenPayload.userId);
      requestHeaders.set('x-username', tokenPayload.username);
      requestHeaders.set('x-wallet-address', tokenPayload.walletAddress);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
  }

  // Default: continue without modification
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

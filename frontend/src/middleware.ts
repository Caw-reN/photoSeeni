import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Ambil token dari cookie
  const token = request.cookies.get('snapjoy_token')?.value;

  // Jika tidak ada token, redirect ke halaman login
  if (!token) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // Lanjutkan request jika ada token
  return NextResponse.next();
}

// Batasi middleware berjalan di halaman dashboard dan admin
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};

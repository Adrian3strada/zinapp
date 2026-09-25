import type { NextConfig } from 'next';

const djangoOrigin = (process.env.DJANGO_ORIGIN || 'http://127.0.0.1:8000').replace(
  /\/$/,
  '',
);

const nextConfig: NextConfig = {
  output: 'standalone',
  trailingSlash: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'zinapp.com.mx', pathname: '/media/**' },
      { protocol: 'https', hostname: 'www.zinapp.com.mx', pathname: '/media/**' },
      { protocol: 'http', hostname: '127.0.0.1', pathname: '/media/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/media/**' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${djangoOrigin}/api/:path*` },
      { source: '/media/:path*', destination: `${djangoOrigin}/media/:path*` },
      { source: '/static/:path*', destination: `${djangoOrigin}/static/:path*` },
      { source: '/app', destination: `${djangoOrigin}/app/` },
      { source: '/app/:path*', destination: `${djangoOrigin}/app/:path*` },
      { source: '/panel', destination: `${djangoOrigin}/panel/` },
      { source: '/panel/:path*', destination: `${djangoOrigin}/panel/:path*` },
      { source: '/pos/:path*', destination: `${djangoOrigin}/pos/:path*` },
    ];
  },
};

export default nextConfig;

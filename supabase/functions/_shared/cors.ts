// CORS configuration with origin validation
// Only allow requests from known application domains

const ALLOWED_ORIGINS = [
  'https://ridereadydocs.co.uk',
  'https://www.ridereadydocs.co.uk',
  'https://ridereadydocs.com',
  'https://www.ridereadydocs.com',
  'https://ride-ready-docs.lovable.app',
  'http://localhost:5173',  // Vite dev server
  'http://localhost:8910',  // Lovable preview
  'http://localhost:3000',  // Alternative dev port
];

// Check if we're in development mode
const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';

export const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
  // In development, be more permissive
  if (isDevelopment && requestOrigin) {
    return {
      'Access-Control-Allow-Origin': requestOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
    };
  }

  // Check if origin is in allowed list
  const isAllowed = requestOrigin && ALLOWED_ORIGINS.some(allowed => 
    requestOrigin === allowed ||
    requestOrigin.endsWith('.lovableproject.com') ||
    requestOrigin.endsWith('.lovable.app')
  );

  return {
    'Access-Control-Allow-Origin': isAllowed && requestOrigin ? requestOrigin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
};

// Handle CORS preflight requests
export const handleCorsPreflightRequest = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, { 
      status: 204,
      headers: getCorsHeaders(origin) 
    });
  }
  return null;
};

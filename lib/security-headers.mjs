/* Security headers for every response the Worker emits. Static assets served before the Worker use public/_headers.
   Calls are peer-to-peer WebRTC between family devices: no third-party call host appears in the CSP or in Permissions-Policy. */
export function contentSecurityPolicy() {
  const openai = 'https://api.openai.com';
  return [
    "default-src 'self'",
    "script-src 'self' https://www.youtube.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://i.ytimg.com",
    "media-src 'self' blob:",
    `connect-src 'self' ${openai}`,
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "worker-src 'self' blob:",
    "font-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

export function securityHeaders(env = {}, {api = false} = {}) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin'
  };
  if (env.HSTS !== 'off') headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  if (api) headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'";
  else if (env.CSP_MODE === 'enforce') headers['Content-Security-Policy'] = contentSecurityPolicy(env);
  else if (env.CSP_MODE !== 'off') headers['Content-Security-Policy-Report-Only'] = contentSecurityPolicy(env);
  return headers;
}

export function withHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(extra)) if (!headers.has(name)) headers.set(name, value);
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}

/* Security headers for every response the Worker emits. Static assets served before the Worker use public/_headers. */
const JITSI_DEFAULT = 'meet.jit.si';

export function contentSecurityPolicy(env = {}) {
  const jitsi = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(env.JITSI_HOST || '') ? env.JITSI_HOST : JITSI_DEFAULT;
  const openai = 'https://api.openai.com';
  return [
    "default-src 'self'",
    `script-src 'self' https://www.youtube.com https://${jitsi}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://i.ytimg.com",
    "media-src 'self' blob:",
    `connect-src 'self' ${openai} https://${jitsi} wss://${jitsi}`,
    `frame-src https://www.youtube-nocookie.com https://www.youtube.com https://${jitsi}`,
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
  const jitsi = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(env.JITSI_HOST || '') ? env.JITSI_HOST : JITSI_DEFAULT;
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': `camera=(self "https://${jitsi}"), microphone=(self "https://${jitsi}"), geolocation=(), payment=(), usb=(), interest-cohort=()`,
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

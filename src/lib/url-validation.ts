import { URL } from 'url';
import { isIP } from 'net';

/**
 * Validate that a baseUrl points to a safe local/private network destination.
 * Prevents SSRF attacks by blocking public IPs, cloud metadata endpoints, etc.
 */
export function validateLocalBaseUrl(baseUrl: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Only allow http (not https, ftp, file, etc.) for local servers
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Protocol "${parsed.protocol}" not allowed` };
  }

  // Block credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Credentials in URL not allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Allow localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return { valid: true };
  }

  // Block cloud metadata endpoints
  const blockedIPs = [
    '169.254.169.254', // AWS/GCP/Azure metadata
    '100.100.100.200', // Alibaba Cloud metadata
    'fd00::',          // IPv6 unique local
  ];
  if (blockedIPs.includes(hostname)) {
    return { valid: false, reason: 'Cloud metadata endpoint blocked' };
  }

  // Check if it's an IP address
  const ipVersion = isIP(hostname);
  if (ipVersion) {
    if (isPrivateIP(hostname)) {
      return { valid: true };
    }
    return { valid: false, reason: 'Only localhost and private network IPs are allowed' };
  }

  // Non-IP hostnames: only allow .local, .internal, .lan domains
  const allowedSuffixes = ['.local', '.internal', '.lan', '.home'];
  if (allowedSuffixes.some((s) => hostname.endsWith(s))) {
    return { valid: true };
  }

  return { valid: false, reason: 'Only localhost, private IPs, and .local domains are allowed' };
}

function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8 loopback
    if (parts[0] === 127) return true;
  }

  // IPv6: fe80::/10 (link-local), fc00::/7 (unique local)
  const lower = ip.toLowerCase();
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }

  return false;
}

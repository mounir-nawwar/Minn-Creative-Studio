export function isValidImageUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(urlString);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
      return { valid: false, error: 'Localhost URLs are not allowed' };
    }

    const privateIpPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^192\.0\.0\./,
      /^192\.0\.2\./,
      /^198\.51\.100\./,
      /^203\.0\.113\./,
      /^198\.18\./,
      /^fc00:/i,
      /^fe80:/i,
    ];

    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'Private IP addresses are not allowed' };
      }
    }

    if (hostname === 'metadata.google.internal' || hostname.endsWith('.internal')) {
      return { valid: false, error: 'Internal hostnames are not allowed' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

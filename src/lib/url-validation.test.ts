import { describe, it, expect } from 'vitest';
import { validateLocalBaseUrl } from './url-validation';

describe('validateLocalBaseUrl', () => {
  describe('valid: localhost variants', () => {
    it('accepts localhost', () => {
      expect(validateLocalBaseUrl('http://localhost:11434/v1')).toEqual({ valid: true });
    });

    it('accepts 127.0.0.1', () => {
      expect(validateLocalBaseUrl('http://127.0.0.1:8080')).toEqual({ valid: true });
    });

    it('accepts ::1', () => {
      expect(validateLocalBaseUrl('http://[::1]:8080')).toEqual({ valid: true });
    });
  });

  describe('valid: private IPs', () => {
    it('accepts 10.x.x.x range', () => {
      expect(validateLocalBaseUrl('http://10.0.0.1:8080')).toEqual({ valid: true });
    });

    it('accepts 172.16-31.x.x range', () => {
      expect(validateLocalBaseUrl('http://172.16.0.1:8080')).toEqual({ valid: true });
      expect(validateLocalBaseUrl('http://172.31.255.255:8080')).toEqual({ valid: true });
    });

    it('accepts 192.168.x.x range', () => {
      expect(validateLocalBaseUrl('http://192.168.1.100:8080')).toEqual({ valid: true });
    });
  });

  describe('valid: local domains', () => {
    it('accepts .local domains', () => {
      expect(validateLocalBaseUrl('http://myserver.local:8080')).toEqual({ valid: true });
    });

    it('accepts .internal domains', () => {
      expect(validateLocalBaseUrl('http://llm.internal:8080')).toEqual({ valid: true });
    });

    it('accepts .lan domains', () => {
      expect(validateLocalBaseUrl('http://nas.lan:8080')).toEqual({ valid: true });
    });

    it('accepts .home domains', () => {
      expect(validateLocalBaseUrl('http://server.home:8080')).toEqual({ valid: true });
    });
  });

  describe('invalid: public IPs', () => {
    it('rejects public IP 8.8.8.8', () => {
      const result = validateLocalBaseUrl('http://8.8.8.8:8080');
      expect(result.valid).toBe(false);
    });

    it('rejects public IP 1.1.1.1', () => {
      const result = validateLocalBaseUrl('http://1.1.1.1:8080');
      expect(result.valid).toBe(false);
    });
  });

  describe('invalid: cloud metadata endpoints', () => {
    it('blocks AWS/GCP metadata (169.254.169.254)', () => {
      const result = validateLocalBaseUrl('http://169.254.169.254/latest/meta-data/');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('metadata');
    });

    it('blocks Alibaba Cloud metadata (100.100.100.200)', () => {
      const result = validateLocalBaseUrl('http://100.100.100.200/');
      expect(result.valid).toBe(false);
    });
  });

  describe('invalid: public domains', () => {
    it('rejects google.com', () => {
      const result = validateLocalBaseUrl('http://google.com');
      expect(result.valid).toBe(false);
    });

    it('rejects api.openai.com', () => {
      const result = validateLocalBaseUrl('https://api.openai.com/v1');
      expect(result.valid).toBe(false);
    });
  });

  describe('invalid: credentials in URL', () => {
    it('rejects URL with username', () => {
      const result = validateLocalBaseUrl('http://admin@localhost:8080');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Credentials');
    });

    it('rejects URL with username and password', () => {
      const result = validateLocalBaseUrl('http://admin:secret@localhost:8080');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Credentials');
    });
  });

  describe('invalid: blocked protocols', () => {
    it('rejects ftp protocol', () => {
      const result = validateLocalBaseUrl('ftp://localhost/file');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Protocol');
    });

    it('rejects file protocol', () => {
      const result = validateLocalBaseUrl('file:///etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Protocol');
    });
  });

  describe('invalid: malformed URLs', () => {
    it('rejects invalid URL format', () => {
      const result = validateLocalBaseUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid URL');
    });
  });

  describe('edge: HTTPS is allowed', () => {
    it('allows https for localhost', () => {
      expect(validateLocalBaseUrl('https://localhost:8443')).toEqual({ valid: true });
    });
  });
});

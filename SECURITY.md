# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Hojaa, please report it responsibly:

- **Email**: security@dashgensolutions.com
- **Do NOT** open a public GitHub issue for security vulnerabilities

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Supported Versions

| Version | Supported |
|:--------|:---------:|
| 1.0.x   | Yes       |

## Security Features

Hojaa includes the following security measures:

- **JWT Authentication** with configurable token expiration
- **Rate Limiting** — sliding window, per-IP and per-user
- **CSRF Protection** — Origin/Referer header validation
- **Security Headers** — XSS protection, clickjack prevention, content type sniffing prevention
- **Input Sanitization** — HTML stripping on user inputs
- **API Key Management** — scoped API keys for external integrations
- **Role-Based Access Control** — owner, admin, editor, viewer roles per organization
- **Audit Trail** — every scope change is logged with attribution
- **Password Hashing** — bcrypt with salt

## Self-Hosted Security Recommendations

When deploying Hojaa on your own infrastructure:

1. **Change `SECRET_KEY`** to a random 64+ character string
2. **Set `ENVIRONMENT=production`** and **`DEBUG=False`**
3. **Configure `CORS_ORIGINS`** to only your domain
4. **Use HTTPS** via a reverse proxy (nginx, Caddy, etc.)
5. **Rotate API keys** regularly
6. **Use a managed PostgreSQL** with encryption at rest if available
7. **Keep Docker images updated** for security patches

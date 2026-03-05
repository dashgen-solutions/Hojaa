# Contributing to Hojaa

Thank you for your interest in contributing to Hojaa! This guide will help you get started.

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Docker version, browser)
- Relevant logs (`make logs`)

## Suggesting Features

Open an issue with:
- Problem description
- Proposed solution
- Alternatives considered

## Development Setup

```bash
git clone https://github.com/dashgen-solutions/hojaa.git
cd hojaa
cp .env.example .env           # Add your API keys
make up                         # Start all services
```

See [README.md](README.md) for detailed setup instructions.

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `make test`
5. Commit with clear messages
6. Push and open a Pull Request

## Code Style

### Python (Backend)
- Follow PEP 8
- Max line length: 120 characters
- Use type hints
- Use async/await for I/O operations

### TypeScript (Frontend)
- Follow the existing ESLint configuration
- Use TypeScript strict mode
- Prefer functional components with hooks

## Pull Request Process

1. Update documentation if needed
2. Ensure tests pass
3. Request review from maintainers
4. Squash commits before merge

## Questions?

Open a discussion or reach out to the maintainers.

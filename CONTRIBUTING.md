# Contributing to Game Server Manager

Thanks for contributing to GSM.

This file follows GitHub's recommended structure for contributor guidelines and covers:

- How to report issues
- How to submit pull requests
- Development and testing expectations
- Community and security expectations

For environment setup and local workflows, see `docs/development.md`.

## Before You Start

- Search existing issues and pull requests first to avoid duplicates.
- For larger changes, open an issue first to confirm scope and approach.
- Keep changes focused. Separate unrelated work into separate pull requests.

## Reporting Issues

When opening an issue, include:

- What happened and what you expected
- Steps to reproduce
- Logs or screenshots (if relevant)
- Environment details (OS, Docker version, browser, and GSM version/commit)

## Pull Request Guidelines

1. Fork the repo and create a feature branch from `main`.
2. Make your changes with clear, focused commits.
3. Run relevant tests locally.
4. Update docs when behavior or setup changes.
5. Open a pull request with a clear description.

A good pull request includes:

- Problem statement
- Summary of changes
- Test evidence
- Any risks or follow-up work

## Development Workflow

Use the development stack in `docker-compose.dev.yml`.

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Full setup and local non-Docker workflow are documented in `docs/development.md`.

## Testing Expectations

Run tests for affected parts before opening a pull request:

```bash
cd server && npm test
cd ../client && npm test
```

## Commit Messages

Use Conventional Commits:

- `feat: add backup retention validation`
- `fix: handle missing docker container status`
- `docs: update development setup`

Format:

```text
<type>: <short description>
```

## Security and Secrets

- Never commit secrets (`.env`, API keys, tokens, passwords).
- Use `.env.example` for placeholders only.
- If you discover a security issue, do not post sensitive details publicly in issues.
- Follow `SECURITY.md` for the private vulnerability reporting process.

## Community Expectations

- Be respectful and constructive in issues and pull requests.
- Assume good intent and focus feedback on code and behavior.

## Questions

If you are unsure where to start, open an issue describing your idea and constraints.

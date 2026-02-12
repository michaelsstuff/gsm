# Security Policy

## Supported Versions

Security updates are provided for actively maintained code.

| Version | Supported |
| --- | --- |
| Latest release | :white_check_mark: |
| `main` branch | :white_check_mark: |
| Older releases | :x: |

## Reporting a Vulnerability

Please do not report security vulnerabilities in public GitHub issues.

Use GitHub private vulnerability reporting for this repository:

1. Open the repository on GitHub.
2. Go to the **Security** tab.
3. Under **Reporting**, click **Report a vulnerability**.
4. Provide clear reproduction steps, impact, and affected components.

Include as much detail as possible:

- Affected version, commit SHA, or branch
- Steps to reproduce
- Proof of concept (if available)
- Potential impact and attack scenario
- Suggested remediation (optional)

## What to Expect

- Initial acknowledgment target: within 72 hours
- Triage and severity assessment: as quickly as possible after acknowledgment
- Status updates: at least weekly for active reports
- Fix and disclosure timing: coordinated with the reporter based on severity and risk

## Disclosure Policy

Please allow time for investigation and remediation before public disclosure.

After a fix is available, maintainers may publish details through a GitHub Security Advisory.

## Scope

This policy covers vulnerabilities in:

- Backend API and authentication flows (`server/`)
- Frontend application (`client/`)
- Container and deployment configuration in this repository
- Documentation/security-sensitive operational guidance

Out of scope unless a clear security impact is shown:

- Feature requests and general hardening suggestions without an exploit path
- Issues in third-party services outside this repository's control

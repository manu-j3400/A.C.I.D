## 2025-05-25 - [Remove Hardcoded GitHub OAuth Secrets]
**Vulnerability:** Found hardcoded GitHub OAuth credentials (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) within `middleware/app.py`.
**Learning:** Hardcoded credentials within application source code is a critical security vulnerability and can lead to unauthorized access if the codebase is leaked.
**Prevention:** Using environment variables to inject sensitive data.

## 2025-05-25 - [Remove Hardcoded JWT Secret]
**Vulnerability:** Hardcoded fallback `JWT_SECRET` found in `middleware/app.py`.
**Learning:** A hardcoded fallback defeats the purpose of environment variables. If the environment variable is missing, the application will silently fall back to a known, insecure secret. This could allow attackers to forge tokens.
**Prevention:** If an environment variable is required for security (like a JWT secret) and is missing, the application should generate a random string, fail securely, or refuse to start, rather than use a hardcoded default.

## 2025-05-25 - [Remove Hardcoded Default Admin Credentials]
**Vulnerability:** Found hardcoded fallback `admin123` password for the default admin account within `middleware/app.py`.
**Learning:** Default hardcoded passwords can be easily guessed or found by an attacker if the source code is leaked. An attacker gaining admin privileges can completely compromise the application. Even if it's meant to be changed later, a default password is a critical security risk.
**Prevention:** Rather than using a hardcoded default password, the system should expect an environment variable (e.g., `ADMIN_PASSWORD`). If none is provided, it should generate a secure, random fallback password on startup and display it once, or prompt the user to set a password during the initial setup.

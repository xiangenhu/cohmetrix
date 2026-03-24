# Team Security Audit

Execute comprehensive security audit with the security team.

## Scope: $ARGUMENTS
Options: full | api | frontend | auth | dependencies

## Step 0: Discover Project Context

Before any audit, scan the codebase to understand:
- **Stack**: Language, framework, runtime
- **Auth pattern**: OAuth, JWT, session cookies, API keys — how auth works in this project
- **Data layer**: Database, ORM, external storage, caching
- **External services**: APIs, cloud providers, third-party integrations
- **Deployment**: Container, serverless, cloud platform, network exposure
- **Existing security**: Middleware, rate limiting, input validation, CSP headers

Use this context to focus the audit on real attack surfaces, not theoretical ones.

## Workflow Phases

### Phase 1: Scanning (Parallel)
Launch simultaneously:
- **Security Vulnerability Scanner**: OWASP Top 10, code vulnerabilities
- **Static Code Analyzer**: Security-related code patterns
- **Dependency Manager**: Package vulnerabilities, outdated deps

### Phase 2: Analysis (Sequential)
- **Security Specialist**: Deep analysis of all findings, compliance review

### Phase 3: Remediation Planning (Parallel)
Launch simultaneously:
- **Architect**: Architecture changes needed
- **Fullstack Developer**: Code fix recommendations

## Scope-Specific Focus

### full (default)
- All endpoints and routes
- All authentication flows
- All data handling
- All dependencies
- Infrastructure configuration

### api
- API endpoint security
- Input validation
- Rate limiting
- Authentication/authorization
- Response sanitization

### frontend
- XSS vulnerabilities
- CSRF protection
- Content Security Policy
- Client-side data handling
- Third-party script security

### auth
- Authentication implementation (discover pattern in Step 0)
- Token/session handling
- Cookie security settings
- Credential storage
- Session timeout and revocation

### dependencies
- Dependency audit results (npm audit, pip audit, etc.)
- Known CVEs
- Outdated packages
- License compliance
- Supply chain risks

## Security Checklist

### Authentication
- [ ] Credentials stored securely (not in client-side storage unless encrypted)
- [ ] Proper cookie settings (httpOnly, Secure, SameSite) if using cookies
- [ ] CSRF protection enabled for state-changing operations
- [ ] Session timeout implemented
- [ ] Brute force protection (rate limiting on auth endpoints)

### API Security
- [ ] Rate limiting on all public endpoints
- [ ] Input validation on all endpoints
- [ ] Output sanitization (no raw error details in responses)
- [ ] Proper error handling (no stack traces in production)
- [ ] Authentication middleware on protected routes
- [ ] Authorization checks (not just authentication)

### External Service Integration
- [ ] API keys not exposed client-side
- [ ] Request/response validation
- [ ] Rate limiting on outbound calls
- [ ] Timeout and retry configuration
- [ ] Error handling for service failures

### Data Protection
- [ ] No PII in logs
- [ ] Encryption at rest for sensitive data
- [ ] Secure transmission (HTTPS/TLS)
- [ ] Privacy compliance (GDPR, CCPA, etc. as applicable)
- [ ] Secrets management (env vars, not hardcoded)

## Output Format

```
## Security Audit Report

### Executive Summary
- Overall Risk Level: [Critical/High/Medium/Low]
- Total Vulnerabilities: [count]
- Critical: [count] | High: [count] | Medium: [count] | Low: [count]

### Critical Findings (Immediate Action Required)
1. **[CWE-XXX]** - [Description]
   - Location: [file:line]
   - Impact: [description]
   - Remediation: [steps]
   - Priority: P0

### High Severity Findings
[Similar format]

### Medium Severity Findings
[Similar format]

### Low Severity Findings
[Similar format]

### Dependency Vulnerabilities
| Package | Current | Vulnerable | Fixed In | Severity |
|---------|---------|------------|----------|----------|
| [pkg]   | [ver]   | [versions] | [ver]    | [level]  |

### Compliance Status
- OWASP Top 10: [status per category]

### Remediation Priority
1. [High priority fix]
2. [Medium priority fix]
3. [Low priority fix]

### Recommended Architecture Changes
- [change 1]
- [change 2]

### Next Steps
1. [immediate action]
2. [short-term action]
3. [long-term action]
```

## Agent Prompts

### Security Vulnerability Scanner
```
You are the Security Vulnerability Scanner.

FIRST: Scan the codebase to discover the auth pattern, data handling, API routes, and external integrations.

Focus: ${scope}

Scan for:
1. OWASP Top 10 vulnerabilities
2. Authentication/authorization flaws
3. Injection vulnerabilities (SQL, XSS, command, path traversal)
4. Sensitive data exposure (secrets in code, PII in logs, client-side tokens)
5. Security misconfiguration (permissive CORS, missing headers)
6. Broken access control (missing auth checks, privilege escalation)

For each finding provide:
- CWE reference if applicable
- Exact file:line location
- Reproduction steps
- Severity (Critical/High/Medium/Low)
- Remediation recommendation
```

### Security Specialist
```
You are the Security Specialist performing deep analysis.

FIRST: Scan the codebase to understand the full security posture — auth, data flow, external services, deployment config.

Review all scanner findings and:
1. Validate each vulnerability (filter false positives)
2. Assess real-world exploitability in this project's context
3. Check project-specific security patterns (discovered in Step 0)
4. Verify compliance requirements applicable to the project
5. Prioritize remediation efforts by risk and effort
6. Recommend architectural improvements for defense in depth
```

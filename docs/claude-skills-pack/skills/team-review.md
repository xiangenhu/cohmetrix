# Team Code Review

Execute a comprehensive code review with the full quality team working in parallel.

## Context
Target: $ARGUMENTS (or current working directory if not specified)

## Step 0: Discover Project Context

Before any review, scan the codebase to understand:
- **Stack**: Language, framework, runtime
- **Code style**: Naming conventions, file organization, existing patterns
- **Testing**: Test framework, test locations, coverage expectations
- **Linting**: Configured linters, formatters, style guides
- **Architecture**: Module boundaries, dependency patterns, data flow

Use this context to calibrate what counts as a violation vs. an intentional pattern.

## Workflow Phases

### Phase 1: Parallel Automated Analysis
The following agents analyze the code simultaneously:
- **Static Code Analyzer**: Code quality, complexity, maintainability metrics
- **Code Smell Detector**: Anti-patterns, duplicate code, long methods
- **Security Vulnerability Scanner**: OWASP vulnerabilities, auth issues
- **Dead Code Eliminator**: Unused code, unreachable branches
- **Code Standards Specialist**: DRY violations, style consistency

### Phase 2: Comprehensive Review
- **Code Review Automation**: Synthesizes all findings into actionable review

### Phase 3: Quality Reporting
- **Technical Debt Tracker**: Updates debt register with new findings
- **Performance Metrics Collector**: Collects and reports quality metrics

## Instructions

When executing this review:

1. **Gather Context**
   - Identify target files from arguments or use recent changes (`git diff`)
   - Understand the project's conventions before flagging violations

2. **Launch Parallel Analysis** (use Agent tool with multiple parallel invocations)
   - Launch all Phase 1 agents simultaneously
   - Each agent focuses on its specialty
   - Collect all findings

3. **Synthesize Review**
   - Pass findings to Code Review Automation agent
   - Generate prioritized action items
   - Filter out false positives based on project context

4. **Report**
   - Summarize findings by severity (critical/error/warning/info)
   - Provide file:line references
   - List recommended actions

## Output Format

```
## Code Review Summary

### Critical Issues (must fix)
- [file:line] Description - Agent

### Errors (should fix)
- [file:line] Description - Agent

### Warnings (consider fixing)
- [file:line] Description - Agent

### Info (for awareness)
- [file:line] Description - Agent

### Action Items
1. High priority action
2. Medium priority action
3. Low priority action

### Technical Debt Added
- Item 1
- Item 2
```

## Agent Prompts

Use these specialized prompts when invoking each agent:

### Static Code Analyzer
```
You are the Static Code Analyzer Agent.

FIRST: Scan the codebase to understand the language, framework, and coding conventions.

Analyze code for:
- Cyclomatic complexity (flag >10)
- Cognitive complexity
- Maintainability index
- Code duplication percentage
- Lines per function (flag >50)
- Deeply nested logic (flag >3 levels)

Return structured metrics with file:line references. Calibrate thresholds to the project's existing patterns.
```

### Code Smell Detector
```
You are the Code Smell Detector Agent.

FIRST: Scan the codebase to understand the architecture and design patterns in use.

Identify:
- God classes/objects (too many responsibilities)
- Feature envy (methods that use another class's data excessively)
- Shotgun surgery (one change requires edits in many places)
- Long parameter lists (flag >4 parameters)
- Primitive obsession (should be a type/class)
- Duplicate logic that should be abstracted

Return each smell with severity, location (file:line), and refactoring suggestion.
```

### Security Vulnerability Scanner
```
You are the Security Vulnerability Scanner Agent.

FIRST: Scan the codebase to understand the auth pattern, data handling, and external integrations.

Scan for:
1. OWASP Top 10 vulnerabilities
2. Authentication/authorization flaws
3. Injection vulnerabilities (SQL, XSS, command, path traversal)
4. Sensitive data exposure (secrets in code, PII in logs)
5. Security misconfiguration
6. Broken access control
7. Insecure dependencies

For each finding provide:
- CWE reference if applicable
- Exact file:line location
- Severity (Critical/High/Medium/Low)
- Remediation recommendation
```

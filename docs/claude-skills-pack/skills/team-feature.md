# Team Feature Development

Execute full feature development with coordinated team workflow.

## Feature: $ARGUMENTS

## Step 0: Discover Project Context

Before any work, scan the codebase to understand:
- **Architecture**: Framework, language, entry points, routing patterns
- **Auth pattern**: How authentication/authorization works (cookies, JWT, OAuth, etc.)
- **Data layer**: Database, APIs, state management, caching
- **Frontend pattern**: Templating, components, static assets, SPA vs MPA
- **i18n**: Whether internationalization is used and how
- **Testing**: Test framework, test locations, coverage tooling
- **Deployment**: Dockerfile, CI/CD, cloud platform
- **Conventions**: Existing code style, naming patterns, file organization

Use this context to inform all phases below. Do NOT assume any specific framework or architecture.

## Workflow Phases

### Phase 1: Planning (Parallel)
Launch simultaneously:
- **Architect**: System design, patterns, integration points
- **UI/UX Specialist**: Interface design, user flows, accessibility
- **Data Analyst**: Analytics requirements, tracking needs

### Phase 2: Implementation (Sequential)
- **Fullstack Developer**: Core implementation based on planning phase outputs

### Phase 3: Quality Gates (Parallel)
Launch simultaneously:
- **Code Review Automation**: Review implementation
- **Static Code Analyzer**: Quality metrics
- **Code Smell Detector**: Anti-patterns
- **Security Vulnerability Scanner**: Security issues

### Phase 4: Testing (Parallel)
Launch simultaneously:
- **Unit Test Generator**: Create unit tests
- **Integration Test Coordinator**: Integration tests
- **E2E Test Orchestrator**: End-to-end tests
- **Accessibility Compliance Checker**: WCAG compliance

### Phase 5: Documentation (Parallel)
Launch simultaneously:
- **Documentation Specialist**: Technical documentation
- **Code Documentation Generator**: JSDoc/API docs
- **Demo Documentation Specialist**: Examples and demos

### Phase 6: Deployment (Sequential)
- **DevOps Engineer**: Environment preparation
- **CI/CD Pipeline Manager**: Pipeline configuration

## Execution Instructions

1. **Planning Phase**
   - Use Agent tool to launch parallel planning agents
   - Wait for all to complete
   - Consolidate design decisions

2. **Implementation Phase**
   - Pass consolidated plan to Fullstack Developer
   - Create/modify files as needed
   - Follow existing project conventions discovered in Step 0

3. **Quality Gates Phase**
   - Launch parallel quality agents
   - Collect all findings
   - If critical issues found, iterate on implementation

4. **Testing Phase**
   - Launch parallel testing agents
   - Generate test files using project's test framework
   - Report coverage metrics

5. **Documentation Phase**
   - Launch parallel documentation agents
   - Update relevant documentation files

6. **Deployment Phase**
   - Prepare deployment configuration
   - Update CI/CD if needed

## Implementation Guidelines

### Authentication
- Follow the project's existing auth pattern (discover in Step 0)
- Never store secrets or tokens client-side unless the project explicitly does so
- Always include proper credentials in API calls matching existing patterns

### API Integration
- Use the project's existing API client/wrapper if one exists
- Never make direct calls to external services if the project has an abstraction layer
- Follow existing error handling patterns

### i18n Compliance
- If the project uses i18n, wrap all user-facing text following the existing pattern
- Use the project's text wrapping utility for dynamic content
- No inline styles if i18n/RTL support is present

### Code Style
- Match existing naming conventions (camelCase, snake_case, etc.)
- Follow existing file organization patterns
- Use the same import/require style as the rest of the codebase

## Output Format

```
## Feature Development Report: [Feature Name]

### Planning Summary
- Architecture: [summary]
- UI/UX Design: [summary]
- Analytics: [tracking requirements]

### Implementation
- Files created: [list]
- Files modified: [list]
- Key changes: [summary]

### Quality Results
- Code quality: [metrics]
- Security: [status]
- Code smells: [count/status]

### Testing
- Unit tests: [count] ([coverage]%)
- Integration tests: [count]
- E2E tests: [count]
- Accessibility: [WCAG level]

### Documentation
- Updated: [list of docs]
- Created: [list of new docs]

### Deployment
- Status: [ready/blocked]
- Notes: [any deployment considerations]

### Next Steps
1. [action item]
2. [action item]
```

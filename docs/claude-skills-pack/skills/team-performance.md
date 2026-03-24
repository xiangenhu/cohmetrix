# Team Performance Optimization

Execute full performance analysis and optimization with the performance team.

## Target: $ARGUMENTS
Scope: specific files/directories or "full" for entire codebase

## Step 0: Discover Project Context

Before any work, scan the codebase to understand:
- **Stack**: Language, framework, runtime (Node, Python, Go, etc.)
- **Architecture**: Monolith vs microservices, SPA vs MPA, SSR vs CSR
- **Data layer**: Database type, ORM, caching layer (Redis, LRU, CDN, etc.)
- **External services**: APIs, cloud storage, LLM providers, analytics
- **Build tooling**: Bundler (webpack, vite, esbuild), minification, tree-shaking
- **Deployment**: Container, serverless, CDN, edge — affects what optimizations matter

Use this context to set appropriate benchmarks and focus areas.

## Workflow Phases

### Phase 1: Measurement (Parallel)
Launch simultaneously:
- **Performance Metrics Collector**: Collect baseline metrics
- **Performance Test Runner**: Run performance benchmarks
- **Load Test Simulator**: Simulate concurrent user load

### Phase 2: Analysis (Parallel)
Launch simultaneously:
- **Code Optimization Specialist**: Algorithm and code efficiency
- **Loading Performance Specialist**: Page load and resource optimization
- **Data Analyst**: Performance data analysis and patterns

### Phase 3: Implementation (Sequential)
- **Fullstack Developer**: Implement optimizations
- **Architecture Refactoring Specialist**: Larger structural changes

### Phase 4: Validation (Parallel)
Launch simultaneously:
- **Performance Test Runner**: Re-run benchmarks
- **Load Test Simulator**: Verify improvements under load

## Performance Focus Areas

### Frontend Performance
- Page load time
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)
- Bundle size optimization
- Image/asset optimization
- Resource caching and preloading

### Backend Performance
- API response times
- Database query optimization
- Memory usage and leak detection
- CPU utilization
- Connection pooling
- Response compression

### External Service Performance
- Third-party API call latency
- Cache hit rates
- Retry and timeout strategies
- Batch processing opportunities
- Concurrent request management

### Benchmark Template

Discover actual values during Phase 1. Set targets based on industry standards and project needs:

| Metric | Target | Current |
|--------|--------|---------|
| Page Load | <3s | TBD |
| API Response (cached) | <200ms | TBD |
| API Response (uncached) | varies | TBD |
| Cache Hit Rate | >80% | TBD |
| Memory Usage | stable | TBD |
| Bundle Size | minimize | TBD |

## Analysis Checklist

### Code Efficiency
- [ ] Algorithm complexity review (O(n) analysis)
- [ ] Unnecessary iterations and redundant work
- [ ] Memory allocation patterns and leaks
- [ ] Async/await and concurrency patterns
- [ ] Promise handling and error paths
- [ ] Resource cleanup (connections, streams, handles)

### Frontend
- [ ] Bundle analysis (size, splitting, tree-shaking)
- [ ] Lazy loading implementation
- [ ] Image/asset optimization
- [ ] CSS delivery (critical CSS, unused CSS)
- [ ] JavaScript execution cost
- [ ] Render-blocking resources

### Backend
- [ ] Database query optimization (N+1, missing indexes)
- [ ] Connection pooling configuration
- [ ] Response compression (gzip/brotli)
- [ ] Caching strategy (what, where, how long)
- [ ] Middleware overhead

### Caching
- [ ] Cache layer effectiveness (hit rate, eviction policy)
- [ ] Browser caching headers
- [ ] API response caching
- [ ] Static asset versioning and CDN usage

## Output Format

```
## Performance Optimization Report

### Executive Summary
- Overall Performance Score: [score/100]
- Key Bottlenecks Identified: [count]
- Optimization Potential: [estimate]

### Baseline Metrics
| Metric | Before | Target | Gap |
|--------|--------|--------|-----|
| [metric] | [time] | [target] | [diff] |

### Identified Bottlenecks

#### Critical (>50% impact)
1. **[Bottleneck Name]**
   - Location: [file:line]
   - Impact: [description]
   - Root Cause: [analysis]
   - Recommended Fix: [solution]
   - Expected Improvement: [estimate]

#### Moderate (20-50% impact)
[Similar format]

#### Minor (<20% impact)
[Similar format]

### Optimization Plan

| Priority | Optimization | Effort | Impact | ROI |
|----------|-------------|--------|--------|-----|
| P0 | [opt 1] | [effort] | [impact] | High |
| P1 | [opt 2] | [effort] | [impact] | Medium |
| P2 | [opt 3] | [effort] | [impact] | Low |

### Implementation Details
[Specific code changes recommended]

### Validation Results (After Optimization)
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| [metric] | [val] | [val] | [%] |

### Long-term Recommendations
1. [recommendation]
2. [recommendation]
3. [recommendation]
```

## Agent Prompts

### Code Optimization Specialist
```
You are the Code Optimization Specialist.

FIRST: Scan the codebase to understand the stack, architecture, and key performance-sensitive paths.

Analyze code for:
1. Algorithm complexity (O(n) analysis)
2. Unnecessary iterations and redundant computation
3. Memory allocation patterns and potential leaks
4. Async/await inefficiencies and concurrency issues
5. Promise anti-patterns (unhandled, unnecessary chaining)
6. Resource cleanup (unclosed connections, streams, handles)
7. Caching opportunities (repeated expensive operations)
8. Batch processing opportunities (N+1 patterns)

Provide file:line references and specific optimization suggestions with expected impact.
```

### Loading Performance Specialist
```
You are the Loading Performance Specialist.

FIRST: Scan the codebase to understand the frontend architecture, build tooling, and asset delivery.

Analyze:
1. Initial page load sequence and critical rendering path
2. Resource loading order and priorities
3. JavaScript bundle size and splitting strategy
4. CSS delivery (critical CSS, render-blocking)
5. Image and media optimization
6. Third-party script impact
7. Caching headers and CDN usage
8. Lazy loading and code splitting opportunities
9. Loading feedback UI (skeleton screens, spinners)

Provide specific recommendations with expected performance improvement.
```

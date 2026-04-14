# Code Review Checklist - Connection Validation System

## Pre-Review Checklist
- [ ] Build passes (npm run build)
- [ ] Tests pass (npm test)
- [ ] No TypeScript errors (npx tsc --noEmit)
- [ ] No ESLint warnings (npm run lint)

## Functionality Checklist
- [ ] ImageUpload → Seed blocked correctly
- [ ] ImageUpload → Resize allowed correctly
- [ ] Visual feedback (green/red) works
- [ ] Error boundaries catch errors
- [ ] Toast notifications appear
- [ ] Retry functionality works
- [ ] Accessibility features work (keyboard, screen reader)
- [ ] Performance is acceptable (<1ms validation, 60fps)

## Code Quality Checklist
- [ ] No `any` types
- [ ] Proper TypeScript interfaces
- [ ] JSDoc comments on public APIs
- [ ] Error handling comprehensive
- [ ] Performance optimized (memoization, caching)
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] Security considerations addressed

## Documentation Checklist
- [ ] README.md updated
- [ ] CHANGELOG.md updated
- [ ] API documentation complete
- [ ] Performance monitoring guide
- [ ] Deployment guide

## Before Merging Checklist
- [ ] Senior engineer review
- [ ] QA sign-off
- [ ] Security audit (if needed)
- [ ] Performance benchmarked
- [ ] Rollback plan documented

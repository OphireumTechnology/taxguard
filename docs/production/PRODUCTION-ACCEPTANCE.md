# TaxGuard Production Deployment

## Frozen baseline
- M1-M15 frozen
- Production Integration foundation frozen
- Commit baseline: 6b3d85f
- Tag: taxguard-production-integration-frozen

## Production gates
- [ ] P1 Production Node API deployed
- [ ] P2 HTTPS API endpoint verified
- [ ] P3 HTTP 405 authentication routing resolved
- [ ] P4 Firebase authentication verified
- [ ] P5 Server session creation verified
- [ ] P6 Database persistence verified
- [ ] P7 Tenant isolation verified
- [ ] P8 Production secrets configured
- [ ] P9 CORS policy verified
- [ ] P10 Document Intelligence provider connected
- [ ] P11 Human-review workflow verified
- [ ] P12 Audit integrity verified
- [ ] P13 Monitoring and alerts verified
- [ ] P14 Backup verified
- [ ] P15 Restore test passed
- [ ] P16 Full regression passed
- [ ] P17 Production build passed
- [ ] P18 TypeScript passed
- [ ] P19 End-to-end client workflow passed
- [ ] P20 Authorized production acceptance

## Hard restrictions
- External tax filing remains disabled.
- AI cannot approve material tax decisions.
- No production gate may be marked PASS without evidence.
- HTTP 405 is a release blocker until resolved.

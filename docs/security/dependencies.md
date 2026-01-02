# Dependency Audit

Run the production dependency audit regularly (CI + before releases):

```bash
npm run audit:prod
```

Handling findings:

1. **Assess severity** – prioritize `critical`/`high` issues affecting runtime
   dependencies.
2. **Patch or pin** – update dependencies or add resolutions if an upstream fix
   is available.
3. **Document exceptions** – if a CVE is a false positive or mitigated by usage,
   add a note to this file with the advisory ID, affected package, justification,
   and planned follow-up.
4. **Monitor transitive deps** – rerun the audit after dependency updates and
   during release candidates.

# Why this directory is in this repository

ComfortCrest was meant to live in `azixpart1-ops/comfort-crest`. That
repository is empty and Claude's GitHub App has no write access to it — both
`git push` and the API return 403:

```
remote: Claude doesn't have GitHub access to azixpart1-ops/comfort-crest
        for your organization.
PUT .../comfort-crest/contents/README.md: 403 Resource not accessible by integration
```

This repository is writable and already held the session's designated branch,
`claude/comfortcrest-shopify-theme-shojgq`, so the work landed here under a
directory of its own rather than being lost with the container.

**Nothing at the repository root was touched.** The PawLunova theme in
`shopify/`, `assets/`, `index.html` and the root `README.md` is untouched;
everything ComfortCrest is inside `comfortcrest/`.

## To move it to its own repository

An org admin grants access at
<https://github.com/apps/claude/installations/select_target>, or the account
owner reconnects GitHub under claude.ai Settings → Connectors. Once
`azixpart1-ops/comfort-crest` is writable:

```bash
git subtree split --prefix=comfortcrest -b comfortcrest-only
git push git@github.com:azixpart1-ops/comfort-crest.git comfortcrest-only:main
```

The theme itself is unaffected either way — it is already deployed to the
store as the draft theme `ComfortCrest — Premium (draft)` (ID `206992048459`).

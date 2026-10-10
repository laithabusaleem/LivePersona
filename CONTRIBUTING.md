# Contributing

```powershell
Copy-Item .env.example .env
npm install
npm run build -w @livepersona/core
npm test
npm run typecheck
```

Keep `@livepersona/core` free of DOM and React. Document any new provider’s network requirements and whether it can run offline.

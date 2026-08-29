# Real Pantry — deployment next step

This package is ready for Vercel as a Vite app.

- No secret Supabase credentials are included.
- The browser-safe Supabase publishable key and project URL are embedded as fallbacks.
- Row Level Security in Supabase protects household data.
- Vercel should detect the project as Vite, run `npm run build`, and publish `dist`.

Recommended path:
1. Create a private GitHub repository named `realpantry-alpha`.
2. Upload this package's contents to the repository root.
3. In Vercel, choose Add New > Project and import `realpantry-alpha`.
4. Accept the detected Vite defaults and deploy.
5. Send the resulting `*.vercel.app` URL back to ChatGPT so Supabase auth redirects can be finalized and the live app verified.

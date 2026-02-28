# Valtria Render Studio

Proof of concept for generating HVAC/MEP renders from Dalux BIM reference images.

## What changed

- Supabase Auth now replaces the mock user/admin entry flow.
- Project configuration and render history now persist in Supabase PostgreSQL.
- Generated images are stored in the private Supabase Storage bucket `renders`.
- OpenAI calls still run server-side through a Netlify Function, so the API key is never exposed in the browser.
- Admin settings are scoped per project instead of being stored in `localStorage`.

## Stack

- React + Vite
- Plain CSS with Valtria design tokens
- Netlify Functions
- OpenAI JavaScript SDK
- Supabase Auth + Database + Storage
- Vitest + React Testing Library

## Environment

Create local variables from the templates already included in the repo:

```bash
.env.example
.env.local
```

Required variables:

```bash
OPENAI_API_KEY=your-key
OPENAI_IMAGE_MODEL=gpt-image-1.5
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Commands

```bash
npm install
npm run dev
npm run lint
npm run test
npm run test:coverage
npm run build
```

For the full local flow (frontend + Netlify Functions), run Netlify Dev from the repo root:

```bash
npx netlify dev
```

## Supabase Setup

1. Create a Supabase project and copy the project URL plus the anon key from `Project Settings > API`.
2. Copy the contents of `supabase/schema.sql` into the Supabase SQL Editor and run it.
3. Confirm the private Storage bucket `renders` exists after the SQL script runs.
4. Create users in Supabase Auth before testing the app. Self-signup is not part of this UI.
5. For admin users:
6. Set `user_metadata.role = "admin"` so the SPA shows the admin console.
7. Set `app_metadata.role = "admin"` so the RLS admin policies can read project-wide render history.
8. Populate `.env.local` with `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
9. Add the same frontend variables plus `SUPABASE_SERVICE_ROLE_KEY` to Netlify environment variables so the `generate-image` function can verify Supabase JWTs, upload images, and insert render rows.
10. If you use magic links locally, make sure the Supabase Auth redirect URL list includes your local Vite or Netlify Dev origin.

## Key files

```text
src/
  components/
    AdminConsole.jsx
    AuthScreen.jsx
    FieldControl.jsx
    ImageResultPanel.jsx
    PaletteEditor.jsx
    PresetStrip.jsx
    ReferenceImageInput.jsx
    StepCard.jsx
    ValtriaLogo.jsx
    WizardLayout.jsx
  data/
    defaults.js
    options.js
    presets.js
  lib/
    imageClient.js
    promptBuilder.js
    storage.js
    supabaseClient.js
  styles/
    tokens.css
    base.css
    layout.css
    components.css
  App.jsx

netlify/
  functions/
    generate-image.js

supabase/
  schema.sql
```

## Testing scope

- Supabase auth hydration, password login, and role-based UI separation.
- Project creation and project-specific admin configuration loading.
- Aspect-ratio to OpenAI-size mapping.
- Reference image upload and paste flow.
- Final image rendering, signed-url gallery refresh, and download link state.
- Prompt builder output and HEX normalization.
- Netlify function payload validation, Supabase token checks, Storage upload, and render persistence.

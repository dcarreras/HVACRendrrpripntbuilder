# Valtria Render Studio

Proof of concept for generating HVAC/MEP renders from Dalux BIM reference images.

## What changed

- Mock auth split between `user` and `admin` views inside a single React SPA.
- User flow focuses on form completion, reference image intake, final image generation, and download.
- Admin flow manages hidden technical defaults: OpenAI generation settings, prompt defaults, and the approved HEX palette.
- OpenAI calls run server-side through a Netlify Function, so the API key is never exposed in the browser.
- Admin configuration persists in `localStorage` on the current browser.

## Stack

- React + Vite
- Plain CSS with Valtria design tokens
- Netlify Functions
- OpenAI JavaScript SDK
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
  styles/
    tokens.css
    base.css
    layout.css
    components.css
  App.jsx

netlify/
  functions/
    generate-image.js
```

## Testing scope

- Auth mode switching and role-based UI separation.
- Admin persistence via `localStorage`.
- Aspect-ratio to OpenAI-size mapping.
- Reference image upload and paste flow.
- Final image rendering and download link state.
- Prompt builder output and HEX normalization.
- Netlify function payload validation and safe fallbacks.

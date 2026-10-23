# Bubbles

Offline-first landscape PWA for executive dysfunction — one bubble at a time.

## Quick start

```bash
npm install
npm run dev
```

Open the URL, rotate to landscape, download the on-device companion (Llama 3.2 1B) once, then chat to create bubbles. Drag a bubble into **Focus** to enter Lock-In.

## Features

- Command Center: companion chat + Queue / Focus / Popped board
- Lock-In Pomodoro with optional proof, then POP
- Hybrid AI: Gemini/OpenAI when online + API key; Llama 3.2 1B offline
- Permanent delete (× on any bubble)
- Export / import `.bubbles.gz` (no accounts)
- Install prompt when running in a browser tab

## Cloud AI (Gemini)

1. Open **Settings · AI key** (top-right)
2. Keep provider on **Gemini**
3. Create a key at [Google AI Studio](https://aistudio.google.com/apikey)
4. Paste → **Save key**
5. Stay online and chat — the companion label should show **Cloud** / **Cloud ready**

The key is stored only in this browser’s IndexedDB and is never included in exports.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run preview` — preview production build

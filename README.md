# consilium.sh

Multi-model deliberation in your browser. Five frontier LLMs debate your question — then a judge synthesizes.

## How it works

1. **Blind** — each model answers independently (no herding)
2. **Cross-pollination** — models surface gaps in each other's reasoning
3. **Debate** — structured rounds with a rotating challenger
4. **Judge** — Gemini synthesizes using Analysis of Competing Hypotheses
5. **Critique** — Claude Opus reviews the synthesis for fallacies
6. **Extract** — structured Do Now / Consider Later / Skip recommendations

## Modes

| Mode | Best for |
|------|----------|
| Oxford | Balanced debate on any decision |
| Red Team | Stress-testing a plan before you commit |
| Pre-Mortem | Surfacing failure modes |
| Forecast | Calibrated probability estimates |
| Quick | Fast parallel answers |

## Setup

1. Get an [OpenRouter API key](https://openrouter.ai/keys)
2. Visit [consilium.sh](https://consilium.sh)
3. Paste your key — it stays in your browser, never sent to any server
4. Ask anything

**Cost:** A full Oxford deliberation costs ~$0.50 in OpenRouter credits. Quick mode is ~$0.05.

## Architecture

Client-side only. No backend, no database. Your API key and deliberation history live in `localStorage`. The browser calls OpenRouter's SSE API directly.

Built with Next.js 15 (static export), TypeScript, Tailwind CSS, shadcn/ui.

## Local development

```bash
pnpm install
pnpm dev
```

## Deploy

```bash
pnpm build
pnpm dlx vercel --prod
```

## Related

- [consilium CLI](https://github.com/terry-li-hm/consilium) — the original Rust CLI this is ported from

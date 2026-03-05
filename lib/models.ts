// lib/models.ts
import type { ModeConfig, Panelist } from '@/types/deliberation'

export const PANELISTS: Panelist[] = [
  { name: 'GPT-5.2', model: 'openai/gpt-5.2-pro',          lab: 'OpenAI'    },
  { name: 'Opus',    model: 'anthropic/claude-opus-4-6', lab: 'Anthropic' },
  { name: 'Grok',    model: 'x-ai/grok-4',              lab: 'xAI'       },
  { name: 'Kimi',    model: 'moonshotai/kimi-k2.5',     lab: 'Moonshot'  },
  { name: 'GLM',     model: 'z-ai/glm-5',            lab: 'Zhipu'     },
]

export const JUDGE: Panelist = {
  name: 'Gemini', model: 'google/gemini-3.1-pro-preview', lab: 'Google',
}

export const CRITIC: Panelist = {
  name: 'Opus', model: 'anthropic/claude-opus-4-6', lab: 'Anthropic',
}

export const MODES: ModeConfig[] = [
  {
    id: 'quick',
    label: 'Quick',
    description: 'Parallel answers, fast synthesis',
    tooltip: '4 models answer in parallel. Best for factual questions or when you need a quick gut-check.',
    rounds: 0,
    useBlind: false,
    useXpol: false,
  },
  {
    id: 'oxford',
    label: 'Oxford',
    description: 'Structured debate with a judge',
    tooltip: 'Full council deliberation — blind phase, cross-pollination, debate rounds, and synthesis. Best for decisions with real stakes.',
    rounds: 2,
    useBlind: true,
    useXpol: true,
  },
  {
    id: 'redteam',
    label: 'Red Team',
    description: 'Adversarial challenge of your plan',
    tooltip: 'One model defends, others attack. Best for stress-testing a proposal, strategy, or decision before you commit.',
    rounds: 2,
    useBlind: true,
    useXpol: false,
  },
  {
    id: 'premortem',
    label: 'Pre-Mortem',
    description: 'Imagine failure, trace the causes',
    tooltip: 'Models imagine the plan failed and work backwards. Best for surfacing hidden risks before a launch or commitment.',
    rounds: 1,
    useBlind: true,
    useXpol: false,
  },
  {
    id: 'forecast',
    label: 'Forecast',
    description: 'Probability estimates with reasoning',
    tooltip: 'Each model gives a probability estimate and reasoning. Best for calibrated prediction on uncertain outcomes.',
    rounds: 1,
    useBlind: true,
    useXpol: false,
  },
]

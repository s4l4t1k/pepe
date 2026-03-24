# Poker Hand Analyzer Bot

AI-powered Telegram bot for analyzing NL Hold'em cash game hands using GPT-4o.

## Stack

- **Bot**: Python + aiogram 3.x (Telegram)
- **Backend**: FastAPI
- **Database**: SQLite + SQLAlchemy async
- **AI**: OpenAI GPT-4o

## Setup

### 1. Install dependencies

```bash
cd /Users/robertsilin/trener
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `TELEGRAM_BOT_TOKEN` — get from [@BotFather](https://t.me/BotFather)
- `OPENAI_API_KEY` — get from [platform.openai.com](https://platform.openai.com)

### 3. Run the bot

```bash
python -m bot.main
```

### 4. (Optional) Run the API separately

```bash
uvicorn api.main:app --reload --port 8000
```

## Supported hand formats

### Format 1 — Structured shorthand

```
NL100
Hero: AhKh
CO open 2.5bb
Hero 3bet 10bb
BTN fold
CO call

Flop: Kd 7s 2c
Hero cbet 8bb
CO fold
```

### Format 2 — PokerStars hand history

Paste a full PokerStars hand history directly.

## Bot commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + instructions |
| `/analyze` | Start hand analysis |
| `/history` | Show last 5 analyzed hands |
| `/help` | Command reference |

## Project structure

```
trener/
├── bot/
│   ├── main.py              # Bot entry point
│   ├── keyboards.py         # Inline keyboards
│   └── handlers/
│       ├── start.py         # /start, /help
│       ├── analyze.py       # /analyze + FSM flow
│       └── history.py       # /history
├── api/
│   ├── main.py              # FastAPI app
│   └── routes/
│       └── hands.py         # /api/analyze, /api/history
├── core/
│   ├── database.py          # SQLAlchemy async, DB helpers
│   ├── parser.py            # Hand history parser
│   └── ai_analyzer.py       # OpenAI GPT-4o integration
├── models/
│   └── schemas.py           # Pydantic models
├── .env.example
└── requirements.txt
```

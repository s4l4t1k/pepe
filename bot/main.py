"""
Poker Coach AI — Telegram Bot entry point.
Run with: python -m bot.main
"""
import asyncio
import logging
import os
import ssl
import sys
import traceback

# Fix SSL certificate verification on macOS
try:
    import certifi
    ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())
except ImportError:
    pass

import aiohttp
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import ErrorEvent
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from core.database import init_db
from bot.handlers import start, analyze, history, training, assistant, profile

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("bot.log"),
        logging.StreamHandler(sys.stdout),
    ]
)
# Reduce noise from third-party libs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("anthropic").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


async def on_startup(bot: Bot) -> None:
    await init_db()
    me = await bot.get_me()
    logger.info("Bot started: @%s (id=%d)", me.username, me.id)


async def on_shutdown(bot: Bot) -> None:
    logger.info("Bot is shutting down...")
    await bot.session.close()


async def main() -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.error("TELEGRAM_BOT_TOKEN is not set.")
        sys.exit(1)

    # Disable SSL verification — needed when traffic goes through a proxy/VPN
    # that replaces Telegram's SSL certificate (e.g. LEXX proxy)
    connector = aiohttp.TCPConnector(ssl=False)
    session = AiohttpSession()
    session._connector_type = aiohttp.TCPConnector
    session._connector_init = {"ssl": False}

    bot = Bot(
        token=token,
        session=session,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    # Global error handler — logs ALL unhandled exceptions with full traceback
    @dp.errors()
    async def global_error_handler(event: ErrorEvent) -> bool:
        logger.error(
            "Unhandled exception on update %s:\n%s",
            event.update.update_id if event.update else "?",
            "".join(traceback.format_exception(type(event.exception), event.exception, event.exception.__traceback__)),
        )
        # Try to notify the user
        try:
            if event.update and event.update.callback_query:
                await event.update.callback_query.answer("❌ Произошла ошибка. Попробуйте ещё раз.", show_alert=True)
            elif event.update and event.update.message:
                await event.update.message.answer("❌ Произошла ошибка. Попробуйте ещё раз.")
        except Exception:
            pass
        return True

    dp.include_router(analyze.router)
    dp.include_router(training.router)
    dp.include_router(profile.router)
    dp.include_router(history.router)
    dp.include_router(start.router)
    dp.include_router(assistant.router)

    logger.info("Starting polling...")
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())

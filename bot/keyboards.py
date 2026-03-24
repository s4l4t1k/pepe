from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder
from typing import List


# ── Main menu ────────────────────────────────────────────────────────────────

def main_menu_keyboard() -> InlineKeyboardMarkup:
    """Main menu shown after /start for registered users."""
    builder = InlineKeyboardBuilder()
    builder.button(text="🃏 Анализ раздачи", callback_data="analyze_new")
    builder.button(text="📸 Анализ скрина", callback_data="analyze_screen")
    builder.button(text="📚 Обучение", callback_data="training_menu")
    builder.button(text="❓ Задать вопрос", callback_data="ask_question")
    builder.button(text="📊 Мой прогресс", callback_data="my_progress")
    builder.button(text="📋 История", callback_data="show_history")
    builder.adjust(2, 2, 2)
    return builder.as_markup()


# ── Registration keyboards ───────────────────────────────────────────────────

def phone_keyboard() -> ReplyKeyboardMarkup:
    """Reply keyboard with share phone button."""
    builder = ReplyKeyboardBuilder()
    builder.button(text="📱 Поделиться номером", request_contact=True)
    builder.button(text="⏭ Пропустить")
    builder.adjust(1)
    return builder.as_markup(resize_keyboard=True, one_time_keyboard=True)


def remove_keyboard() -> ReplyKeyboardRemove:
    return ReplyKeyboardRemove()


def experience_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🟢 Новичок (< 1 года, играю ради фана)", callback_data="exp_beginner")
    builder.button(text="🟡 Любитель (1-3 года, нерегулярно)", callback_data="exp_amateur")
    builder.button(text="🔵 Полурег (3-5 лет, серьёзно)", callback_data="exp_semipro")
    builder.button(text="🔴 Регуляр (5+ лет, профессионально)", callback_data="exp_pro")
    builder.adjust(1)
    return builder.as_markup()


def play_style_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🦁 LAG (Loose-Aggressive)", callback_data="style_lag")
    builder.button(text="🐢 TAG (Tight-Aggressive)", callback_data="style_tag")
    builder.button(text="🦊 LAP (Loose-Passive)", callback_data="style_lap")
    builder.button(text="🛡️ TAP (Tight-Passive)", callback_data="style_tap")
    builder.button(text="🤔 Не знаю свой стиль", callback_data="style_unknown")
    builder.adjust(1)
    return builder.as_markup()


# ── Analyze keyboards ────────────────────────────────────────────────────────

def analyze_again_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🃏 Анализировать другую раздачу", callback_data="analyze_new")
    builder.button(text="📸 Анализировать скрин", callback_data="analyze_screen")
    builder.button(text="📋 История раздач", callback_data="show_history")
    builder.button(text="🏠 Главное меню", callback_data="main_menu")
    builder.adjust(1, 1, 2)
    return builder.as_markup()


def cancel_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="❌ Отмена", callback_data="cancel_input")
    return builder.as_markup()


def history_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🃏 Анализировать раздачу", callback_data="analyze_new")
    builder.button(text="🏠 Главное меню", callback_data="main_menu")
    builder.adjust(1)
    return builder.as_markup()


# ── Training keyboards ───────────────────────────────────────────────────────

MODULES = [
    ("📚 Модуль 1: Основы", "mod1"),
    ("🎯 Модуль 2: Постфлоп", "mod2"),
    ("🔥 Модуль 3: Продвинутые концепции", "mod3"),
    ("💰 Модуль 4: Банкролл и психология", "mod4"),
]

LESSONS = {
    "mod1": [
        ("1.1 Позиции за столом", "lesson_1_1"),
        ("1.2 Базовые диапазоны открытия", "lesson_1_2"),
        ("1.3 Пот-оддсы и математика", "lesson_1_3"),
        ("1.4 Базовая стратегия префлопа", "lesson_1_4"),
    ],
    "mod2": [
        ("2.1 Текстура борда", "lesson_2_1"),
        ("2.2 Continuation bet стратегия", "lesson_2_2"),
        ("2.3 Блефы и value беты", "lesson_2_3"),
        ("2.4 Ranges thinking", "lesson_2_4"),
    ],
    "mod3": [
        ("3.1 Баланс диапазонов", "lesson_3_1"),
        ("3.2 GTO vs Exploitative", "lesson_3_2"),
        ("3.3 Мультиway поты", "lesson_3_3"),
        ("3.4 Mental game", "lesson_3_4"),
    ],
    "mod4": [
        ("4.1 Управление банкроллом", "lesson_4_1"),
        ("4.2 Работа с тильтом", "lesson_4_2"),
        ("4.3 Статистика и анализ", "lesson_4_3"),
    ],
}

LESSON_TOPICS = {
    "lesson_1_1": "Позиции за покерным столом: UTG, MP, CO, BTN, SB, BB — их значение и стратегия",
    "lesson_1_2": "Базовые диапазоны открытия с каждой позиции в NL Hold'em",
    "lesson_1_3": "Пот-оддсы, имплайд-оддсы и математика покера",
    "lesson_1_4": "Базовая стратегия префлопа: 3-беты, колл-диапазоны, фолды",
    "lesson_2_1": "Текстура борда: wet vs dry, paired boards, monotone boards",
    "lesson_2_2": "Continuation bet стратегия: когда и как делать c-bet",
    "lesson_2_3": "Value betting и блефы: как правильно строить свой диапазон",
    "lesson_2_4": "Думать диапазонами: range vs range, equity calculations",
    "lesson_3_1": "Балансировка диапазонов: bluff-to-value ratio, polarization",
    "lesson_3_2": "GTO vs Exploitative стратегия: когда использовать каждый подход",
    "lesson_3_3": "Мультиway поты: стратегия в пот с несколькими участниками",
    "lesson_3_4": "Mental game: тильт, концентрация, принятие решений под давлением",
    "lesson_4_1": "Управление банкроллом: правила, стопы, выбор лимитов",
    "lesson_4_2": "Работа с тильтом: распознавание, профилактика, восстановление",
    "lesson_4_3": "Статистика и анализ игры: VPIP, PFR, AF, как использовать HUD",
}


def training_menu_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for name, mod_id in MODULES:
        builder.button(text=name, callback_data=f"training_{mod_id}")
    builder.button(text="🏠 Главное меню", callback_data="main_menu")
    builder.adjust(1)
    return builder.as_markup()


def module_lessons_keyboard(module_id: str, completed: List[str]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    lessons = LESSONS.get(module_id, [])
    for lesson_name, lesson_id in lessons:
        check = "✅ " if lesson_id in completed else "▶️ "
        builder.button(text=f"{check}{lesson_name}", callback_data=f"lesson_{lesson_id}")
    builder.button(text="◀️ К модулям", callback_data="training_menu")
    builder.button(text="🏠 Главное меню", callback_data="main_menu")
    builder.adjust(1)
    return builder.as_markup()


def retry_lesson_keyboard(lesson_id: str, module_id: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🔄 Попробовать снова", callback_data=f"lesson_{lesson_id}")
    builder.button(text="◀️ К модулю", callback_data=f"training_{module_id}")
    builder.button(text="🏠 Главное меню", callback_data="main_menu")
    builder.adjust(1)
    return builder.as_markup()


def retry_analyze_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🔄 Попробовать снова", callback_data="analyze_new")
    builder.button(text="🏠 Главное меню", callback_data="main_menu")
    builder.adjust(1)
    return builder.as_markup()


def lesson_done_keyboard(lesson_id: str, module_id: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Урок пройден!", callback_data=f"complete_{lesson_id}")
    builder.button(text="◀️ К модулю", callback_data=f"training_{module_id}")
    builder.button(text="🏠 Главное меню", callback_data="main_menu")
    builder.adjust(1)
    return builder.as_markup()


def quiz_keyboard(lesson_id: str, options: List[str], correct: str = "A") -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    answer_keys = ["A", "B", "C", "D"]
    for i, opt in enumerate(options[:4]):
        key = answer_keys[i]
        label = opt[:64] if len(opt) > 64 else opt
        # Encode chosen + correct in callback: qz_{lesson_id}_{chosen}_{correct}
        builder.button(text=label, callback_data=f"qz_{lesson_id}_{key}_{correct}")
    builder.adjust(1)
    return builder.as_markup()


# ── Assistant keyboards ──────────────────────────────────────────────────────

def assistant_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🔄 Новый вопрос", callback_data="ask_question")
    builder.button(text="🧹 Очистить историю", callback_data="clear_chat")
    builder.button(text="🏠 Главное меню", callback_data="main_menu")
    builder.adjust(2, 1)
    return builder.as_markup()


# ── Profile keyboards ────────────────────────────────────────────────────────

def progress_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="📚 Начать обучение", callback_data="training_menu")
    builder.button(text="🃏 Анализировать раздачу", callback_data="analyze_new")
    builder.button(text="🏠 Главное меню", callback_data="main_menu")
    builder.adjust(1)
    return builder.as_markup()

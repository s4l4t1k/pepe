"""
Hand history parser.

Supports two formats:
1. Structured shorthand (custom format used in the bot)
2. PokerStars hand history
"""
import re
from typing import List, Optional, Tuple

from models.schemas import ParsedHand, ActionItem


# ── Card / position helpers ─────────────────────────────────────────────────

VALID_RANKS = set("23456789TJQKA")
VALID_SUITS = set("cdhs")
POSITIONS = {"UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB", "MP", "EP"}

ACTION_ALIASES = {
    "open": "open",
    "raise": "raise",
    "3bet": "3bet",
    "4bet": "4bet",
    "5bet": "5bet",
    "call": "call",
    "fold": "fold",
    "check": "check",
    "bet": "bet",
    "cbet": "cbet",
    "allin": "allin",
    "all-in": "allin",
    "all_in": "allin",
}


def _parse_cards(token: str) -> List[str]:
    """Parse a string of cards like 'AhKh' or 'Kd 7s 2c' into a list."""
    cards = []
    token = token.strip().replace(",", " ")
    # Try space-separated first
    parts = token.split()
    for part in parts:
        part = part.strip("[](){}")
        i = 0
        while i < len(part):
            if i + 1 < len(part) and part[i].upper() in VALID_RANKS and part[i+1].lower() in VALID_SUITS:
                cards.append(part[i].upper() + part[i+1].lower())
                i += 2
            else:
                i += 1
    return cards


def _parse_bb_size(token: str) -> Optional[float]:
    """Extract a numeric bb value from tokens like '2.5bb', '10BB', '30%', '$5'."""
    if token is None:
        return None
    token = token.strip().lower().rstrip("bb").rstrip("$")
    try:
        return float(token)
    except ValueError:
        return None


def _parse_size_token(token: str) -> Optional[float]:
    """Parse size from various formats: '2.5bb', '2.5BB', '30%', '$5.00'."""
    if not token:
        return None
    token = token.strip()
    # Percentage — keep as-is (will be noted but not converted)
    pct_match = re.match(r"(\d+(?:\.\d+)?)%", token)
    if pct_match:
        return None  # percentage sizes are noted in raw but not converted to bb

    bb_match = re.match(r"(\d+(?:\.\d+)?)(?:bb|BB|Bb)?$", token.replace("$", ""))
    if bb_match:
        return float(bb_match.group(1))
    return None


# ── Structured shorthand parser ─────────────────────────────────────────────

def _parse_structured(text: str) -> ParsedHand:
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    hand = ParsedHand(raw_text=text)

    actions: List[ActionItem] = []
    current_street = "preflop"
    pot = 0.0
    hero_position: Optional[str] = None

    for line in lines:
        line_lower = line.lower()

        # ── Stakes / game type ──
        stakes_match = re.match(r"^NL(\d+)$", line, re.IGNORECASE)
        if stakes_match:
            nl = int(stakes_match.group(1))
            hand.stakes = f"NL{nl}"
            hand.game_type = "NL Holdem"
            continue

        full_stakes = re.match(r"^\$?([\d.]+)/\$?([\d.]+)$", line)
        if full_stakes:
            hand.stakes = line
            continue

        # ── Hero cards ──
        hero_match = re.match(r"^Hero(?:\s*\((\w+)\))?\s*:\s*(.+)$", line, re.IGNORECASE)
        if hero_match:
            pos_token = hero_match.group(1)
            cards_token = hero_match.group(2)
            if pos_token:
                hero_position = pos_token.upper()
                hand.hero_position = hero_position
            hand.hero_cards = _parse_cards(cards_token)
            continue

        # ── Stack ──
        stack_match = re.match(r"^(?:Stack|Hero\s+stack)\s*[=:]?\s*([\d.]+)\s*(?:bb|BB)?", line, re.IGNORECASE)
        if stack_match:
            hand.stack_bb = float(stack_match.group(1))
            continue

        # ── Board streets ──
        flop_match = re.match(r"^Flop\s*[:\-]?\s*(.+)$", line, re.IGNORECASE)
        if flop_match:
            current_street = "flop"
            hand.flop = _parse_cards(flop_match.group(1))
            continue

        turn_match = re.match(r"^Turn\s*[:\-]?\s*(.+)$", line, re.IGNORECASE)
        if turn_match:
            current_street = "turn"
            cards = _parse_cards(turn_match.group(1))
            hand.turn = cards[0] if cards else None
            continue

        river_match = re.match(r"^River\s*[:\-]?\s*(.+)$", line, re.IGNORECASE)
        if river_match:
            current_street = "river"
            cards = _parse_cards(river_match.group(1))
            hand.river = cards[0] if cards else None
            continue

        # ── Pot ──
        pot_match = re.match(r"^Pot\s*[=:]?\s*([\d.]+)\s*(?:bb|BB)?", line, re.IGNORECASE)
        if pot_match:
            hand.pot_bb = float(pot_match.group(1))
            continue

        # ── Actions: POSITION ACTION [SIZE] ──
        # e.g. "CO open 2.5bb", "BTN call", "Hero cbet 30%", "SB fold"
        action_match = re.match(
            r"^(Hero|UTG\d?|EP|MP\d?|LJ|HJ|CO|BTN|SB|BB)\s+(\w[\w\-]*)\s*([\d.]+(?:bb|BB|%|\$)?)?",
            line,
            re.IGNORECASE,
        )
        if action_match:
            pos = action_match.group(1).upper()
            act_raw = action_match.group(2).lower()
            size_token = action_match.group(3) or ""

            # Normalize action
            act = ACTION_ALIASES.get(act_raw, act_raw)

            size_bb: Optional[float] = None
            if size_token:
                size_bb = _parse_size_token(size_token)

            # Track pot roughly
            if size_bb and act in ("open", "raise", "3bet", "4bet", "bet", "cbet"):
                pot += size_bb
            elif size_bb and act == "call":
                pot += size_bb

            # Detect hero position from actions
            if pos == "HERO" and not hand.hero_position:
                hand.hero_position = "HERO"

            actions.append(ActionItem(
                position=pos,
                action=act,
                size_bb=size_bb,
                street=current_street,
            ))
            continue

    hand.actions = actions
    if hand.pot_bb is None and pot > 0:
        hand.pot_bb = round(pot, 2)

    # Compile board
    board: List[str] = []
    if hand.flop:
        board.extend(hand.flop)
    if hand.turn:
        board.append(hand.turn)
    if hand.river:
        board.append(hand.river)
    hand.board = board if board else None

    return hand


# ── PokerStars hand history parser ──────────────────────────────────────────

def _parse_pokerstars(text: str) -> ParsedHand:
    hand = ParsedHand(raw_text=text)
    actions: List[ActionItem] = []
    current_street = "preflop"

    # Stakes
    stakes_match = re.search(r"\(\$?([\d.]+)/\$?([\d.]+)", text)
    if stakes_match:
        hand.stakes = f"${stakes_match.group(1)}/${stakes_match.group(2)}"
        hand.game_type = "NL Holdem"

    # Hero cards
    hero_cards_match = re.search(r"Dealt to (\w+) \[(.+?)\]", text)
    if hero_cards_match:
        hand.hero_cards = _parse_cards(hero_cards_match.group(2))

    # Hero position — find Hero in seat/position lines
    hero_name_match = re.search(r"Dealt to (\w+)", text)
    hero_name = hero_name_match.group(1) if hero_name_match else None

    # Stack size for hero
    if hero_name:
        stack_match = re.search(
            rf"{re.escape(hero_name)}\s*\(.*?\$?([\d.]+)\s*in chips\)", text
        )
        if not stack_match:
            stack_match = re.search(
                rf"Seat \d+: {re.escape(hero_name)} \(\$?([\d.]+)\)", text
            )
        if stack_match:
            raw_stack = float(stack_match.group(1))
            # Try to derive bb
            bb_val: Optional[float] = None
            if stakes_match:
                try:
                    bb_val = float(stakes_match.group(2))
                except Exception:
                    pass
            if bb_val and bb_val > 0:
                hand.stack_bb = round(raw_stack / bb_val, 1)
            else:
                hand.stack_bb = raw_stack

    # Streets
    lines = text.splitlines()
    for line in lines:
        line = line.strip()
        if re.match(r"\*\*\* HOLE CARDS \*\*\*", line):
            current_street = "preflop"
            continue
        if re.match(r"\*\*\* FLOP \*\*\*", line):
            current_street = "flop"
            cards = _parse_cards(re.sub(r"\*\*\*.*?\*\*\*", "", line))
            hand.flop = cards if cards else hand.flop
            continue
        if re.match(r"\*\*\* TURN \*\*\*", line):
            current_street = "turn"
            cards = _parse_cards(re.sub(r"\*\*\*.*?\*\*\*", "", line))
            hand.turn = cards[-1] if cards else hand.turn
            continue
        if re.match(r"\*\*\* RIVER \*\*\*", line):
            current_street = "river"
            cards = _parse_cards(re.sub(r"\*\*\*.*?\*\*\*", "", line))
            hand.river = cards[-1] if cards else hand.river
            continue

        # Actions
        if hero_name:
            action_match = re.match(
                rf"^{re.escape(hero_name)}: (raises|calls|folds|checks|bets)(?: \$?([\d.]+))?",
                line,
            )
            if action_match:
                act_raw = action_match.group(1)
                size_raw = action_match.group(2)
                act_map = {
                    "raises": "raise",
                    "calls": "call",
                    "folds": "fold",
                    "checks": "check",
                    "bets": "bet",
                }
                act = act_map.get(act_raw, act_raw)
                size_bb: Optional[float] = None
                if size_raw:
                    bb_val_inner = None
                    if stakes_match:
                        try:
                            bb_val_inner = float(stakes_match.group(2))
                        except Exception:
                            pass
                    if bb_val_inner and bb_val_inner > 0:
                        size_bb = round(float(size_raw) / bb_val_inner, 2)
                    else:
                        size_bb = float(size_raw)
                actions.append(ActionItem(
                    position="HERO",
                    action=act,
                    size_bb=size_bb,
                    street=current_street,
                ))
                continue

        # Other players
        other_match = re.match(
            r"^(\w+): (raises|calls|folds|checks|bets)(?: \$?([\d.]+))?", line
        )
        if other_match and other_match.group(1) != "Dealt":
            act_raw = other_match.group(2)
            size_raw = other_match.group(3)
            act_map = {
                "raises": "raise",
                "calls": "call",
                "folds": "fold",
                "checks": "check",
                "bets": "bet",
            }
            act = act_map.get(act_raw, act_raw)
            size_bb = None
            if size_raw:
                bb_val_inner = None
                if stakes_match:
                    try:
                        bb_val_inner = float(stakes_match.group(2))
                    except Exception:
                        pass
                if bb_val_inner and bb_val_inner > 0:
                    size_bb = round(float(size_raw) / bb_val_inner, 2)
                else:
                    size_bb = float(size_raw)
            actions.append(ActionItem(
                position=other_match.group(1).upper(),
                action=act,
                size_bb=size_bb,
                street=current_street,
            ))

    hand.actions = actions

    # Compile board
    board: List[str] = []
    if hand.flop:
        board.extend(hand.flop)
    if hand.turn:
        board.append(hand.turn)
    if hand.river:
        board.append(hand.river)
    hand.board = board if board else None

    return hand


# ── Public API ───────────────────────────────────────────────────────────────

def parse_hand(text: str) -> ParsedHand:
    """
    Auto-detect format and parse hand history.
    Returns a ParsedHand object.  parse_error is set on failure.
    """
    if not text or not text.strip():
        return ParsedHand(raw_text=text or "", parse_error="Пустой текст раздачи")

    text = text.strip()

    try:
        if "PokerStars" in text or "*** HOLE CARDS ***" in text:
            return _parse_pokerstars(text)
        else:
            return _parse_structured(text)
    except Exception as exc:
        return ParsedHand(raw_text=text, parse_error=f"Ошибка парсинга: {exc}")

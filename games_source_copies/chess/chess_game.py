"""A complete local two-player chess game.

Run with:
    python chess_game.py

The game uses only Python's standard library (Tkinter).
"""

from __future__ import annotations

import copy
import random
import tkinter as tk
from dataclasses import dataclass
from tkinter import messagebox
from typing import Optional


FILES = "abcdefgh"
LIGHT_SQUARE = "#f0d9b5"
DARK_SQUARE = "#b58863"
SELECTED_SQUARE = "#f7ec6e"
MOVE_SQUARE = "#cddc78"
CHECK_SQUARE = "#e57373"
APP_BG = "#161512"
PANEL_BG = "#211f1c"
TEXT = "#f4f1ea"
MUTED = "#aaa39a"

BOARD_THEMES = {
    "Classic": ("#f0d9b5", "#b58863"),
    "Ocean": ("#d7eef2", "#2f7f8f"),
    "Forest": ("#e5f0d5", "#5d8a52"),
    "Rose": ("#f8dce5", "#a95772"),
    "Midnight": ("#c8d0e8", "#46527a"),
    "Amethyst": ("#eadcf5", "#76549a"),
    "Sunset": ("#ffe0b2", "#c45d3c"),
}
AI_LEVELS = ("Easy", "Medium", "Hard", "Extreme")

SYMBOLS = {
    "wK": "\u2654", "wQ": "\u2655", "wR": "\u2656",
    "wB": "\u2657", "wN": "\u2658", "wP": "\u2659",
    "bK": "\u265a", "bQ": "\u265b", "bR": "\u265c",
    "bB": "\u265d", "bN": "\u265e", "bP": "\u265f",
}


@dataclass(frozen=True)
class Move:
    start: tuple[int, int]
    end: tuple[int, int]
    promotion: Optional[str] = None
    castle: bool = False
    en_passant: bool = False


class ChessGame:
    """Chess state and legal move generation."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        back_rank = list("RNBQKBNR")
        self.board: list[list[Optional[str]]] = [
            ["b" + piece for piece in back_rank],
            ["bP"] * 8,
            [None] * 8,
            [None] * 8,
            [None] * 8,
            [None] * 8,
            ["wP"] * 8,
            ["w" + piece for piece in back_rank],
        ]
        self.turn = "w"
        self.castling = {"wK": True, "wQ": True, "bK": True, "bQ": True}
        self.en_passant: Optional[tuple[int, int]] = None
        self.history: list[tuple] = []
        self.move_text: list[str] = []
        self.game_over = False

    @staticmethod
    def other(color: str) -> str:
        return "b" if color == "w" else "w"

    @staticmethod
    def in_bounds(row: int, col: int) -> bool:
        return 0 <= row < 8 and 0 <= col < 8

    def find_king(self, color: str) -> tuple[int, int]:
        for row in range(8):
            for col in range(8):
                if self.board[row][col] == color + "K":
                    return row, col
        raise ValueError(f"{color} king is missing")

    def square_attacked(self, row: int, col: int, by_color: str) -> bool:
        pawn_row = row + (1 if by_color == "w" else -1)
        for pawn_col in (col - 1, col + 1):
            if self.in_bounds(pawn_row, pawn_col) and self.board[pawn_row][pawn_col] == by_color + "P":
                return True

        for dr, dc in ((-2, -1), (-2, 1), (-1, -2), (-1, 2),
                       (1, -2), (1, 2), (2, -1), (2, 1)):
            r, c = row + dr, col + dc
            if self.in_bounds(r, c) and self.board[r][c] == by_color + "N":
                return True

        for dr, dc in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
            r, c = row + dr, col + dc
            while self.in_bounds(r, c):
                piece = self.board[r][c]
                if piece:
                    if piece == by_color + "B" or piece == by_color + "Q":
                        return True
                    break
                r += dr
                c += dc

        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            r, c = row + dr, col + dc
            while self.in_bounds(r, c):
                piece = self.board[r][c]
                if piece:
                    if piece == by_color + "R" or piece == by_color + "Q":
                        return True
                    break
                r += dr
                c += dc

        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if (dr or dc) and self.in_bounds(row + dr, col + dc):
                    if self.board[row + dr][col + dc] == by_color + "K":
                        return True
        return False

    def in_check(self, color: str) -> bool:
        king_row, king_col = self.find_king(color)
        return self.square_attacked(king_row, king_col, self.other(color))

    def pseudo_moves(self, start: tuple[int, int]) -> list[Move]:
        row, col = start
        piece = self.board[row][col]
        if not piece or piece[0] != self.turn:
            return []
        color, kind = piece
        moves: list[Move] = []

        if kind == "P":
            direction = -1 if color == "w" else 1
            last_row = 0 if color == "w" else 7
            next_row = row + direction
            if self.in_bounds(next_row, col) and self.board[next_row][col] is None:
                moves.append(Move(start, (next_row, col), "Q" if next_row == last_row else None))
                home_row = 6 if color == "w" else 1
                if row == home_row and self.board[row + 2 * direction][col] is None:
                    moves.append(Move(start, (row + 2 * direction, col)))
            for next_col in (col - 1, col + 1):
                if not self.in_bounds(next_row, next_col):
                    continue
                target = self.board[next_row][next_col]
                if target and target[0] != color and target[1] != "K":
                    moves.append(Move(start, (next_row, next_col), "Q" if next_row == last_row else None))
                elif self.en_passant == (next_row, next_col):
                    moves.append(Move(start, (next_row, next_col), en_passant=True))

        elif kind == "N":
            for dr, dc in ((-2, -1), (-2, 1), (-1, -2), (-1, 2),
                           (1, -2), (1, 2), (2, -1), (2, 1)):
                self._add_if_open(moves, start, (row + dr, col + dc), color)

        elif kind in "BRQ":
            directions = []
            if kind in "BQ":
                directions += [(-1, -1), (-1, 1), (1, -1), (1, 1)]
            if kind in "RQ":
                directions += [(-1, 0), (1, 0), (0, -1), (0, 1)]
            for dr, dc in directions:
                r, c = row + dr, col + dc
                while self.in_bounds(r, c):
                    target = self.board[r][c]
                    if target is None:
                        moves.append(Move(start, (r, c)))
                    else:
                        if target[0] != color and target[1] != "K":
                            moves.append(Move(start, (r, c)))
                        break
                    r += dr
                    c += dc

        elif kind == "K":
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    if dr or dc:
                        self._add_if_open(moves, start, (row + dr, col + dc), color, reject_king=True)
            home_row = 7 if color == "w" else 0
            if (row, col) == (home_row, 4) and not self.in_check(color):
                enemy = self.other(color)
                if self.castling[color + "K"] and self.board[home_row][5] is None and self.board[home_row][6] is None:
                    if self.board[home_row][7] == color + "R" and not self.square_attacked(home_row, 5, enemy) and not self.square_attacked(home_row, 6, enemy):
                        moves.append(Move(start, (home_row, 6), castle=True))
                if self.castling[color + "Q"] and all(self.board[home_row][c] is None for c in (1, 2, 3)):
                    if self.board[home_row][0] == color + "R" and not self.square_attacked(home_row, 3, enemy) and not self.square_attacked(home_row, 2, enemy):
                        moves.append(Move(start, (home_row, 2), castle=True))
        return moves

    def _add_if_open(self, moves: list[Move], start: tuple[int, int], end: tuple[int, int],
                     color: str, reject_king: bool = False) -> None:
        if not self.in_bounds(*end):
            return
        target = self.board[end[0]][end[1]]
        if target is None or (target[0] != color and (not reject_king or target[1] != "K")):
            moves.append(Move(start, end))

    def legal_moves(self, start: Optional[tuple[int, int]] = None) -> list[Move]:
        starts = [start] if start else [(r, c) for r in range(8) for c in range(8)]
        legal = []
        for square in starts:
            for move in self.pseudo_moves(square):
                snapshot = self._snapshot()
                self.apply(move, record=False)
                if not self.in_check(self.other(self.turn)):
                    legal.append(move)
                self._restore(snapshot)
        return legal

    def _snapshot(self) -> tuple:
        return copy.deepcopy((self.board, self.turn, self.castling, self.en_passant))

    def _restore(self, snapshot: tuple) -> None:
        self.board, self.turn, self.castling, self.en_passant = copy.deepcopy(snapshot)

    def apply(self, move: Move, record: bool = True) -> None:
        if record:
            self.history.append(self._snapshot())
        row, col = move.start
        end_row, end_col = move.end
        piece = self.board[row][col]
        assert piece is not None
        color, kind = piece
        captured = self.board[end_row][end_col]
        self.board[row][col] = None
        if move.en_passant:
            captured = self.board[end_row + (1 if color == "w" else -1)][end_col]
            self.board[end_row + (1 if color == "w" else -1)][end_col] = None
        self.board[end_row][end_col] = color + (move.promotion or kind)

        if kind == "K":
            self.castling[color + "K"] = self.castling[color + "Q"] = False
            if move.castle:
                rook_from = 7 if end_col == 6 else 0
                rook_to = 5 if end_col == 6 else 3
                self.board[end_row][rook_to] = self.board[end_row][rook_from]
                self.board[end_row][rook_from] = None
        elif kind == "R":
            if col == 0:
                self.castling[color + "Q"] = False
            elif col == 7:
                self.castling[color + "K"] = False
        if captured and captured[1] == "R":
            captured_color = captured[0]
            if end_col == 0:
                self.castling[captured_color + "Q"] = False
            elif end_col == 7:
                self.castling[captured_color + "K"] = False

        self.en_passant = None
        if kind == "P" and abs(end_row - row) == 2:
            self.en_passant = ((row + end_row) // 2, col)
        self.turn = self.other(color)
        if record:
            self.move_text.append(self.format_move(move, captured))

    def format_move(self, move: Move, captured: Optional[str]) -> str:
        piece = self.board[move.end[0]][move.end[1]]
        kind = piece[1] if piece else "P"
        if move.castle:
            return "O-O" if move.end[1] == 6 else "O-O-O"
        capture = "x" if captured or move.en_passant else "-"
        text = f"{kind if kind != 'P' else ''}{FILES[move.start[1]]}{move.start[0] + 1}{capture}{FILES[move.end[1]]}{move.end[0] + 1}"
        if move.promotion:
            text += f"={move.promotion}"
        return text

    def undo(self) -> bool:
        if not self.history:
            return False
        self._restore(self.history.pop())
        if self.move_text:
            self.move_text.pop()
        self.game_over = False
        return True

    def status(self) -> str:
        color_name = "White" if self.turn == "w" else "Black"
        if self.legal_moves():
            return f"{color_name} to move" + (" - Check!" if self.in_check(self.turn) else "")
        self.game_over = True
        if self.in_check(self.turn):
            return f"Checkmate - {'Black' if self.turn == 'w' else 'White'} wins!"
        return "Draw - Stalemate"


class ChessApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("♞ Python Chess • Local Arena")
        self.root.resizable(True, True)
        self.root.minsize(980, 680)
        self.root.geometry("1120x760")
        self.root.bind("<F11>", lambda _event: self.toggle_fullscreen())
        self.root.bind("<Escape>", lambda _event: self.exit_fullscreen())
        self.root.bind("<Configure>", self.on_resize)
        self.game = ChessGame()
        self.mode = tk.StringVar(value="2 Players")
        self.ai_level = tk.StringVar(value="Medium")
        self.theme = tk.StringVar(value="Classic")
        self.fullscreen = False
        self.ai_thinking = False
        self.selected: Optional[tuple[int, int]] = None
        self.available: list[Move] = []
        self.buttons: list[list[tk.Button]] = []
        self.status_var = tk.StringVar()
        self.captured_var = tk.StringVar()
        self._build()
        self.refresh()

    def change_difficulty(self, _value: str = "") -> None:
        self.refresh()

    def change_theme(self, _value: str = "") -> None:
        self.refresh()

    def _build(self) -> None:
        self.root.configure(bg=APP_BG)
        outer = tk.Frame(self.root, padx=32, pady=26, bg=APP_BG)
        outer.pack(expand=True)
        self.outer = outer
        header = tk.Frame(outer, bg=APP_BG)
        header.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 18))
        tk.Label(header, text="♞  PYTHON CHESS", font=("Segoe UI", 24, "bold"),
                 fg=TEXT, bg=APP_BG).pack(side="left")
        window_controls = tk.Frame(header, bg=APP_BG)
        window_controls.pack(side="right", padx=(18, 0))
        for label, command in (("—", self.minimize_window), ("□", self.restore_window), ("×", self.close_window)):
            tk.Button(window_controls, text=label, font=("Segoe UI", 12),
                      width=3, fg=MUTED, bg=APP_BG, activeforeground=TEXT,
                      activebackground="#3a3631", relief="flat", bd=0,
                      command=command).pack(side="left")
        tk.Label(header, text="LOCAL ARENA  •  PLAY • THINK • CONQUER", font=("Segoe UI", 9, "bold"),
                 fg="#b89b63", bg=APP_BG).pack(side="right", pady=10)
        board_shell = tk.Frame(outer, bg="#0d0c0b", padx=10, pady=10)
        board_shell.grid(row=1, column=0, sticky="n")
        self.board_shell = board_shell
        board_frame = tk.Frame(board_shell, bg="#0d0c0b")
        board_frame.grid(row=0, column=0)
        for row in range(8):
            line = []
            for col in range(8):
                button = tk.Button(board_frame, width=4, height=1, font=("Segoe UI Symbol", 31),
                                   bd=0, relief="flat", highlightthickness=0,
                                   command=lambda r=row, c=col: self.click(r, c))
                button.grid(row=row, column=col)
                line.append(button)
            self.buttons.append(line)
        side = tk.Frame(outer, bg=PANEL_BG, padx=22, pady=22, width=285, height=560)
        side.grid(row=1, column=1, sticky="ns", padx=(18, 0))
        side.pack_propagate(False)
        tk.Label(side, text="GAME STATUS", font=("Segoe UI", 9, "bold"),
                 fg="#b89b63", bg=PANEL_BG).pack(anchor="w")
        tk.Label(side, text="PLAY MODE", font=("Segoe UI", 9, "bold"),
                 fg="#b89b63", bg=PANEL_BG).pack(anchor="w", pady=(14, 3))
        mode_frame = tk.Frame(side, bg=PANEL_BG)
        mode_frame.pack(fill="x", pady=(0, 10))
        for label in ("2 Players", "Play vs AI"):
            tk.Radiobutton(mode_frame, text=label, variable=self.mode, value=label,
                           command=self.change_mode, font=("Segoe UI", 9),
                           fg=TEXT, bg=PANEL_BG, activebackground=PANEL_BG,
                           activeforeground=TEXT, selectcolor="#3a3631",
                           highlightthickness=0).pack(anchor="w")
        tk.Label(side, text="AI DIFFICULTY", font=("Segoe UI", 9, "bold"),
                 fg="#b89b63", bg=PANEL_BG).pack(anchor="w", pady=(8, 3))
        difficulty_menu = tk.OptionMenu(side, self.ai_level, *AI_LEVELS, command=self.change_difficulty)
        difficulty_menu.configure(font=("Segoe UI", 9, "bold"), fg=TEXT, bg="#3a3631",
                                  activebackground="#514a42", activeforeground=TEXT,
                                  highlightthickness=0, relief="flat", bd=0)
        difficulty_menu["menu"].configure(font=("Segoe UI", 9), bg="#3a3631", fg=TEXT,
                                          activebackground="#d9b875", activeforeground="#171512")
        difficulty_menu.pack(fill="x", pady=(0, 10))
        tk.Label(side, text="BOARD STYLE", font=("Segoe UI", 9, "bold"),
                 fg="#b89b63", bg=PANEL_BG).pack(anchor="w", pady=(0, 3))
        theme_menu = tk.OptionMenu(side, self.theme, *BOARD_THEMES, command=self.change_theme)
        theme_menu.configure(font=("Segoe UI", 9, "bold"), fg=TEXT, bg="#3a3631",
                             activebackground="#514a42", activeforeground=TEXT,
                             highlightthickness=0, relief="flat", bd=0)
        theme_menu["menu"].configure(font=("Segoe UI", 9), bg="#3a3631", fg=TEXT,
                                     activebackground="#d9b875", activeforeground="#171512")
        theme_menu.pack(fill="x", pady=(0, 14))
        tk.Label(side, textvariable=self.status_var, width=24, wraplength=205,
                 justify="left", font=("Segoe UI", 15, "bold"), fg=TEXT, bg=PANEL_BG).pack(anchor="w", pady=(5, 16))
        tk.Label(side, textvariable=self.captured_var, font=("Segoe UI Symbol", 15),
                 fg=MUTED, bg=PANEL_BG, anchor="w").pack(fill="x", pady=(0, 14))
        actions = tk.Frame(side, bg=PANEL_BG)
        actions.pack(fill="x", pady=(0, 18))
        tk.Button(actions, text="NEW GAME", font=("Segoe UI", 9, "bold"), fg="#171512",
                  bg="#d9b875", activebackground="#f0d39a", relief="flat", bd=0,
                  padx=8, pady=8, command=self.new_game).pack(side="left", fill="x", expand=True)
        tk.Button(actions, text="UNDO", font=("Segoe UI", 9, "bold"), fg=TEXT,
                  bg="#3a3631", activebackground="#514a42", relief="flat", bd=0,
                  padx=8, pady=8, command=self.undo).pack(side="left", fill="x", expand=True, padx=(7, 0))
        self.fullscreen_button = tk.Button(side, text="⛶  FULL SCREEN  •  F11", font=("Segoe UI", 9, "bold"), fg=TEXT,
                  bg="#3a3631", activebackground="#514a42", relief="flat", bd=0,
                  padx=8, pady=8, command=self.toggle_fullscreen)
        self.fullscreen_button.pack(fill="x", pady=(0, 18))
        tk.Label(side, text="MOVE HISTORY", fg="#b89b63", bg=PANEL_BG,
                 font=("Segoe UI", 9, "bold")).pack(anchor="w", pady=(0, 5))
        self.moves_box = tk.Listbox(side, width=25, height=17, font=("Consolas", 10),
                                    bg="#181715", fg=TEXT, selectbackground="#655438",
                                    selectforeground=TEXT, relief="flat", bd=0,
                                    highlightthickness=0, activestyle="none")
        self.moves_box.pack()
        tk.Label(outer, text="SELECT A PIECE  →  CHOOSE A HIGHLIGHTED SQUARE",
                 fg=MUTED, bg=APP_BG, font=("Segoe UI", 9, "bold")).grid(
                     row=2, column=0, columnspan=2, pady=(14, 0))

    def on_resize(self, _event: tk.Event) -> None:
        if not hasattr(self, "outer") or _event.widget is not self.root:
            return
        self.root.after_idle(self.resize_board)

    def resize_board(self) -> None:
        if not hasattr(self, "fullscreen_button"):
            return
        if not self.fullscreen:
            self.fullscreen_button.configure(text="⛶  FULL SCREEN  •  F11")
            return
        available_width = max(620, self.root.winfo_width() - 390)
        available_height = max(520, self.root.winfo_height() - 150)
        board_size = min(available_width, available_height)
        square = max(54, board_size // 8)
        font_size = max(25, int(square * 0.43))
        for line in self.buttons:
            for button in line:
                button.configure(width=max(3, int(square / 11)), height=max(1, int(square / 25)),
                                 font=("Segoe UI Symbol", font_size))
        self.fullscreen_button.configure(text="⛶  EXIT FULL SCREEN  •  ESC")

    def refresh(self) -> None:
        light_square, dark_square = BOARD_THEMES[self.theme.get()]
        checked = self.game.find_king(self.game.turn) if self.game.in_check(self.game.turn) else None
        destinations = {move.end for move in self.available}
        for row in range(8):
            for col in range(8):
                button = self.buttons[row][col]
                color = light_square if (row + col) % 2 == 0 else dark_square
                if (row, col) == checked:
                    color = CHECK_SQUARE
                if (row, col) in destinations:
                    color = MOVE_SQUARE
                if (row, col) == self.selected:
                    color = SELECTED_SQUARE
                piece = self.game.board[row][col]
                if piece and piece[0] == "b":
                    piece_color = "#161616"
                elif piece:
                    piece_color = "#6b472b" if (row + col) % 2 == 0 else "#fffdf7"
                else:
                    piece_color = TEXT
                button.configure(text=SYMBOLS.get(piece, ""), bg=color, activebackground=SELECTED_SQUARE,
                                  fg=piece_color)
        self.status_var.set(self.game.status())
        remaining = {"P": 8, "N": 2, "B": 2, "R": 2, "Q": 1, "K": 1}
        captured_white = " ".join(SYMBOLS["w" + kind] for kind, count in remaining.items()
                                  if sum(piece == "w" + kind for row in self.game.board for piece in row) < count)
        captured_black = " ".join(SYMBOLS["b" + kind] for kind, count in remaining.items()
                                  if sum(piece == "b" + kind for row in self.game.board for piece in row) < count)
        self.captured_var.set(f"Captured  {captured_white or '—'}  {captured_black or '—'}")
        self.moves_box.delete(0, tk.END)
        for number in range(0, len(self.game.move_text), 2):
            white = self.game.move_text[number]
            black = self.game.move_text[number + 1] if number + 1 < len(self.game.move_text) else ""
            self.moves_box.insert(tk.END, f"{number // 2 + 1:>2}. {white:<12} {black}")

    def click(self, row: int, col: int) -> None:
        if self.game.game_over or self.ai_thinking or (self.mode.get() == "Play vs AI" and self.game.turn == "b"):
            return
        square = (row, col)
        if self.selected is not None:
            chosen = next((move for move in self.available if move.end == square), None)
            if chosen:
                if chosen.promotion:
                    chosen = self.choose_promotion(chosen)
                    if chosen is None:
                        return
                self.game.apply(chosen)
                self.selected = None
                self.available = []
                self.refresh()
                self.schedule_ai()
                return
        piece = self.game.board[row][col]
        if piece and piece[0] == self.game.turn:
            self.selected = square
            self.available = self.game.legal_moves(square)
        else:
            self.selected = None
            self.available = []
        self.refresh()

    def change_mode(self) -> None:
        if self.game.move_text and not messagebox.askyesno(
                "Change play mode", "Changing mode will start a new game. Continue?"):
            self.mode.set("Play vs AI" if self.mode.get() == "2 Players" else "2 Players")
            return
        self.game.reset()
        self.ai_thinking = False
        self.selected = None
        self.available = []
        self.refresh()

    def schedule_ai(self) -> None:
        if self.mode.get() == "Play vs AI" and self.game.turn == "b" and not self.game.game_over:
            self.ai_thinking = True
            self.status_var.set("AI is thinking...")
            self.root.after(350, self.play_ai_move)

    def play_ai_move(self) -> None:
        if self.game.game_over or self.mode.get() != "Play vs AI" or self.game.turn != "b":
            self.ai_thinking = False
            return
        moves = self.game.legal_moves()
        if moves:
            move = self.choose_ai_move(moves)
            self.game.apply(move)
        self.ai_thinking = False
        self.refresh()

    def choose_ai_move(self, moves: list[Move]) -> Move:
        """Choose a move using a real difficulty-dependent search."""
        if self.ai_level.get() == "Easy":
            return random.choice(moves)

        depths = {"Medium": 1, "Hard": 2, "Extreme": 3}
        depth = depths[self.ai_level.get()]
        best_score = float("-inf")
        best_moves: list[Move] = []
        for move in self.order_moves(moves):
            snapshot = self.game._snapshot()
            self.game.apply(move, record=False)
            score = self.minimax(depth - 1, float("-inf"), float("inf"))
            self.game._restore(snapshot)
            if score > best_score:
                best_score = score
                best_moves = [move]
            elif score == best_score:
                best_moves.append(move)
        return random.choice(best_moves or moves)

    def order_moves(self, moves: list[Move]) -> list[Move]:
        values = {"P": 100, "N": 320, "B": 330, "R": 500, "Q": 900, "K": 20000}
        def move_value(move: Move) -> int:
            target = self.game.board[move.end[0]][move.end[1]]
            capture_value = values.get(target[1], 0) if target else 0
            return capture_value + values.get(move.promotion or "", 0)

        return sorted(
            moves,
            key=move_value,
            reverse=True,
        )

    def evaluate(self) -> int:
        """Return a score from Black's perspective."""
        values = {"P": 100, "N": 320, "B": 330, "R": 500, "Q": 900, "K": 20000}
        score = 0
        for row in self.game.board:
            for piece in row:
                if piece:
                    value = values[piece[1]]
                    score += value if piece[0] == "b" else -value
        return score

    def minimax(self, depth: int, alpha: float, beta: float) -> int:
        moves = self.game.legal_moves()
        if not moves:
            if self.game.in_check(self.game.turn):
                return -30000 if self.game.turn == "b" else 30000
            return 0
        if depth == 0:
            return self.evaluate()

        maximizing = self.game.turn == "b"
        if maximizing:
            value = float("-inf")
            for move in self.order_moves(moves):
                snapshot = self.game._snapshot()
                self.game.apply(move, record=False)
                value = max(value, self.minimax(depth - 1, alpha, beta))
                self.game._restore(snapshot)
                alpha = max(alpha, value)
                if alpha >= beta:
                    break
            return int(value)
        value = float("inf")
        for move in self.order_moves(moves):
            snapshot = self.game._snapshot()
            self.game.apply(move, record=False)
            value = min(value, self.minimax(depth - 1, alpha, beta))
            self.game._restore(snapshot)
            beta = min(beta, value)
            if alpha >= beta:
                break
        return int(value)

    def toggle_fullscreen(self) -> None:
        self.fullscreen = not self.fullscreen
        self.root.attributes("-fullscreen", self.fullscreen)
        if self.fullscreen:
            self.root.configure(cursor="")
        self.root.after(100, self.resize_board)

    def minimize_window(self) -> None:
        self.root.iconify()

    def restore_window(self) -> None:
        self.root.attributes("-fullscreen", False)
        self.fullscreen = False
        self.root.deiconify()
        self.root.state("normal")
        self.root.after(100, self.resize_board)

    def close_window(self) -> None:
        self.root.destroy()

    def exit_fullscreen(self) -> None:
        if self.fullscreen:
            self.fullscreen = False
            self.root.attributes("-fullscreen", False)

    def choose_promotion(self, move: Move) -> Optional[Move]:
        choice = tk.StringVar(value="Q")
        dialog = tk.Toplevel(self.root)
        dialog.title("Promote pawn")
        dialog.transient(self.root)
        dialog.grab_set()
        tk.Label(dialog, text="Choose a piece:", padx=18, pady=10).pack()
        for piece in "QRBN":
            tk.Radiobutton(dialog, text={"Q": "Queen", "R": "Rook", "B": "Bishop", "N": "Knight"}[piece],
                           variable=choice, value=piece).pack(anchor="w", padx=20)
        tk.Button(dialog, text="Promote", command=dialog.destroy).pack(pady=10)
        self.root.wait_window(dialog)
        return Move(move.start, move.end, choice.get(), move.castle, move.en_passant)

    def new_game(self) -> None:
        if self.game.move_text and not messagebox.askyesno("New game", "Start a new game?"):
            return
        self.game.reset()
        self.ai_thinking = False
        self.selected = None
        self.available = []
        self.refresh()

    def undo(self) -> None:
        undone = self.game.undo()
        if undone and self.mode.get() == "Play vs AI" and self.game.turn == "b" and self.game.history:
            undone = self.game.undo()
        if undone:
            self.ai_thinking = False
            self.selected = None
            self.available = []
            self.refresh()


if __name__ == "__main__":
    root = tk.Tk()
    ChessApp(root)
    root.mainloop()
/**
 * MOHAMED KAREEM GAMES — PYTHON CHESS WEB ENGINE
 * 
 * 1-to-1 Faithful port of Mohamed Kareem's `chess_game.py`
 * Retaining the exact rule generator, minimax AI with alpha-beta pruning,
 * 4 AI difficulty depths, 7 board themes, captured pieces tally, and undo stack.
 */

const FILES = "abcdefgh";
const BOARD_THEMES = {
  "Classic": ["#f0d9b5", "#b58863"],
  "Ocean": ["#d7eef2", "#2f7f8f"],
  "Forest": ["#e5f0d5", "#5d8a52"],
  "Rose": ["#f8dce5", "#a95772"],
  "Midnight": ["#c8d0e8", "#46527a"],
  "Amethyst": ["#eadcf5", "#76549a"],
  "Sunset": ["#ffe0b2", "#c45d3c"]
};

const SYMBOLS = {
  "wK": "\u2654", "wQ": "\u2655", "wR": "\u2656",
  "wB": "\u2657", "wN": "\u2658", "wP": "\u2659",
  "bK": "\u265a", "bQ": "\u265b", "bR": "\u265c",
  "bB": "\u265d", "bN": "\u265e", "bP": "\u265f"
};

const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

class ChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    const backRank = ["R", "N", "B", "Q", "K", "B", "N", "R"];
    this.board = [
      backRank.map(p => "b" + p),
      Array(8).fill("bP"),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill(null),
      Array(8).fill("wP"),
      backRank.map(p => "w" + p)
    ];
    this.turn = "w";
    this.castling = { wK: true, wQ: true, bK: true, bQ: true };
    this.en_passant = null;
    this.history = [];
    this.move_text = [];
    this.game_over = false;
  }

  static other(color) {
    return color === "w" ? "b" : "w";
  }

  static in_bounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  find_king(color) {
    const target = color + "K";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === target) return [r, c];
      }
    }
    return [0, 4];
  }

  square_attacked(row, col, by_color) {
    // Pawn attacks
    const pawn_row = row + (by_color === "w" ? 1 : -1);
    for (const pawn_col of [col - 1, col + 1]) {
      if (ChessGame.in_bounds(pawn_row, pawn_col) && this.board[pawn_row][pawn_col] === by_color + "P") {
        return true;
      }
    }

    // Knight attacks
    const knight_dirs = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knight_dirs) {
      const r = row + dr, c = col + dc;
      if (ChessGame.in_bounds(r, c) && this.board[r][c] === by_color + "N") {
        return true;
      }
    }

    // Bishop / Queen diagonals
    const diag_dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diag_dirs) {
      let r = row + dr, c = col + dc;
      while (ChessGame.in_bounds(r, c)) {
        const piece = this.board[r][c];
        if (piece) {
          if (piece === by_color + "B" || piece === by_color + "Q") return true;
          break;
        }
        r += dr; c += dc;
      }
    }

    // Rook / Queen orthogonal
    const ortho_dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of ortho_dirs) {
      let r = row + dr, c = col + dc;
      while (ChessGame.in_bounds(r, c)) {
        const piece = this.board[r][c];
        if (piece) {
          if (piece === by_color + "R" || piece === by_color + "Q") return true;
          break;
        }
        r += dr; c += dc;
      }
    }

    // King attacks
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if ((dr || dc) && ChessGame.in_bounds(row + dr, col + dc)) {
          if (this.board[row + dr][col + dc] === by_color + "K") return true;
        }
      }
    }
    return false;
  }

  in_check(color) {
    const [kr, kc] = this.find_king(color);
    return this.square_attacked(kr, kc, ChessGame.other(color));
  }

  pseudo_moves(start) {
    const [row, col] = start;
    const piece = this.board[row][col];
    if (!piece || piece[0] !== this.turn) return [];
    const color = piece[0], kind = piece[1];
    const moves = [];

    if (kind === "P") {
      const direction = color === "w" ? -1 : 1;
      const last_row = color === "w" ? 0 : 7;
      const next_row = row + direction;
      if (ChessGame.in_bounds(next_row, col) && this.board[next_row][col] === null) {
        moves.push({ start, end: [next_row, col], promotion: next_row === last_row ? "Q" : null });
        const home_row = color === "w" ? 6 : 1;
        if (row === home_row && this.board[row + 2 * direction][col] === null) {
          moves.push({ start, end: [row + 2 * direction, col], promotion: null });
        }
      }
      for (const next_col of [col - 1, col + 1]) {
        if (!ChessGame.in_bounds(next_row, next_col)) continue;
        const target = this.board[next_row][next_col];
        if (target && target[0] !== color && target[1] !== "K") {
          moves.push({ start, end: [next_row, next_col], promotion: next_row === last_row ? "Q" : null });
        } else if (this.en_passant && this.en_passant[0] === next_row && this.en_passant[1] === next_col) {
          moves.push({ start, end: [next_row, next_col], promotion: null, en_passant: true });
        }
      }
    } else if (kind === "N") {
      const knight_dirs = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of knight_dirs) {
        this._add_if_open(moves, start, [row + dr, col + dc], color);
      }
    } else if ("BRQ".includes(kind)) {
      let directions = [];
      if ("BQ".includes(kind)) directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      if ("RQ".includes(kind)) directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      for (const [dr, dc] of directions) {
        let r = row + dr, c = col + dc;
        while (ChessGame.in_bounds(r, c)) {
          const target = this.board[r][c];
          if (target === null) {
            moves.push({ start, end: [r, c], promotion: null });
          } else {
            if (target[0] !== color && target[1] !== "K") {
              moves.push({ start, end: [r, c], promotion: null });
            }
            break;
          }
          r += dr; c += dc;
        }
      }
    } else if (kind === "K") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr || dc) {
            this._add_if_open(moves, start, [row + dr, col + dc], color, true);
          }
        }
      }
      const home_row = color === "w" ? 7 : 0;
      if (row === home_row && col === 4 && !this.in_check(color)) {
        const enemy = ChessGame.other(color);
        if (this.castling[color + "K"] && this.board[home_row][5] === null && this.board[home_row][6] === null) {
          if (this.board[home_row][7] === color + "R" && !this.square_attacked(home_row, 5, enemy) && !this.square_attacked(home_row, 6, enemy)) {
            moves.push({ start, end: [home_row, 6], promotion: null, castle: true });
          }
        }
        if (this.castling[color + "Q"] && [1, 2, 3].every(c => this.board[home_row][c] === null)) {
          if (this.board[home_row][0] === color + "R" && !this.square_attacked(home_row, 3, enemy) && !this.square_attacked(home_row, 2, enemy)) {
            moves.push({ start, end: [home_row, 2], promotion: null, castle: true });
          }
        }
      }
    }
    return moves;
  }

  _add_if_open(moves, start, end, color, reject_king = false) {
    if (!ChessGame.in_bounds(end[0], end[1])) return;
    const target = this.board[end[0]][end[1]];
    if (target === null || (target[0] !== color && (!reject_king || target[1] !== "K"))) {
      moves.push({ start, end, promotion: null });
    }
  }

  legal_moves(start = null) {
    const starts = start ? [start] : [];
    if (!start) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) starts.push([r, c]);
      }
    }
    const legal = [];
    for (const sq of starts) {
      for (const move of this.pseudo_moves(sq)) {
        const snap = this._snapshot();
        this.apply(move, false);
        if (!this.in_check(ChessGame.other(this.turn))) {
          legal.push(move);
        }
        this._restore(snap);
      }
    }
    return legal;
  }

  _snapshot() {
    return {
      board: this.board.map(row => [...row]),
      turn: this.turn,
      castling: { ...this.castling },
      en_passant: this.en_passant ? [...this.en_passant] : null
    };
  }

  _restore(snap) {
    this.board = snap.board.map(row => [...row]);
    this.turn = snap.turn;
    this.castling = { ...snap.castling };
    this.en_passant = snap.en_passant ? [...snap.en_passant] : null;
  }

  apply(move, record = true) {
    if (record) {
      this.history.push(this._snapshot());
    }
    const [row, col] = move.start;
    const [end_row, end_col] = move.end;
    const piece = this.board[row][col];
    const color = piece[0], kind = piece[1];
    let captured = this.board[end_row][end_col];

    this.board[row][col] = null;
    if (move.en_passant) {
      const capRow = end_row + (color === "w" ? 1 : -1);
      captured = this.board[capRow][end_col];
      this.board[capRow][end_col] = null;
    }
    this.board[end_row][end_col] = color + (move.promotion || kind);

    if (kind === "K") {
      this.castling[color + "K"] = this.castling[color + "Q"] = false;
      if (move.castle) {
        const rook_from = end_col === 6 ? 7 : 0;
        const rook_to = end_col === 6 ? 5 : 3;
        this.board[end_row][rook_to] = this.board[end_row][rook_from];
        this.board[end_row][rook_from] = null;
      }
    } else if (kind === "R") {
      if (col === 0) this.castling[color + "Q"] = false;
      else if (col === 7) this.castling[color + "K"] = false;
    }

    if (captured && captured[1] === "R") {
      const capCol = captured[0];
      if (end_col === 0) this.castling[capCol + "Q"] = false;
      else if (end_col === 7) this.castling[capCol + "K"] = false;
    }

    this.en_passant = null;
    if (kind === "P" && Math.abs(end_row - row) === 2) {
      this.en_passant = [Math.floor((row + end_row) / 2), col];
    }

    this.turn = ChessGame.other(color);
    if (record) {
      this.move_text.push(this.format_move(move, captured));
    }
  }

  format_move(move, captured) {
    const piece = this.board[move.end[0]][move.end[1]];
    const kind = piece ? piece[1] : "P";
    if (move.castle) {
      return move.end[1] === 6 ? "O-O" : "O-O-O";
    }
    const cap = captured || move.en_passant ? "x" : "-";
    let text = `${kind !== "P" ? kind : ""}${FILES[move.start[1]]}${8 - move.start[0]}${cap}${FILES[move.end[1]]}${8 - move.end[0]}`;
    if (move.promotion) text += `=${move.promotion}`;
    return text;
  }

  undo() {
    if (this.history.length === 0) return false;
    this._restore(this.history.pop());
    if (this.move_text.length > 0) this.move_text.pop();
    this.game_over = false;
    return true;
  }

  status() {
    const color_name = this.turn === "w" ? "White" : "Black";
    if (this.legal_moves().length > 0) {
      return `${color_name} to move` + (this.in_check(this.turn) ? " — Check!" : "");
    }
    this.game_over = true;
    if (this.in_check(this.turn)) {
      return `Checkmate — ${this.turn === "w" ? "Black" : "White"} wins!`;
    }
    return "Draw — Stalemate";
  }

  // --- MINIMAX AI ENGINE ---
  evaluate() {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece) {
          const val = PIECE_VALUES[piece[1]] || 0;
          score += piece[0] === "b" ? val : -val;
        }
      }
    }
    return score;
  }

  order_moves(moves) {
    return [...moves].sort((a, b) => {
      const targetA = this.board[a.end[0]][a.end[1]];
      const targetB = this.board[b.end[0]][b.end[1]];
      const valA = (targetA ? PIECE_VALUES[targetA[1]] : 0) + (a.promotion ? PIECE_VALUES[a.promotion] : 0);
      const valB = (targetB ? PIECE_VALUES[targetB[1]] : 0) + (b.promotion ? PIECE_VALUES[b.promotion] : 0);
      return valB - valA;
    });
  }

  minimax(depth, alpha, beta) {
    const moves = this.legal_moves();
    if (moves.length === 0) {
      if (this.in_check(this.turn)) {
        return this.turn === "b" ? -30000 : 30000;
      }
      return 0;
    }
    if (depth === 0) return this.evaluate();

    const maximizing = this.turn === "b";
    if (maximizing) {
      let value = -Infinity;
      for (const move of this.order_moves(moves)) {
        const snap = this._snapshot();
        this.apply(move, false);
        value = Math.max(value, this.minimax(depth - 1, alpha, beta));
        this._restore(snap);
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return value;
    } else {
      let value = Infinity;
      for (const move of this.order_moves(moves)) {
        const snap = this._snapshot();
        this.apply(move, false);
        value = Math.min(value, this.minimax(depth - 1, alpha, beta));
        this._restore(snap);
        beta = Math.min(beta, value);
        if (alpha >= beta) break;
      }
      return value;
    }
  }

  choose_ai_move(level) {
    const moves = this.legal_moves();
    if (moves.length === 0) return null;
    if (level === "Easy") {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    const depths = { "Medium": 1, "Hard": 2, "Extreme": 3 };
    const depth = depths[level] || 1;
    let best_score = -Infinity;
    let best_moves = [];

    for (const move of this.order_moves(moves)) {
      const snap = this._snapshot();
      this.apply(move, false);
      const score = this.minimax(depth - 1, -Infinity, Infinity);
      this._restore(snap);

      if (score > best_score) {
        best_score = score;
        best_moves = [move];
      } else if (score === best_score) {
        best_moves.push(move);
      }
    }
    return best_moves.length > 0 ? best_moves[Math.floor(Math.random() * best_moves.length)] : moves[0];
  }
}

window.ChessGame = ChessGame;
window.BOARD_THEMES = BOARD_THEMES;
window.SYMBOLS = SYMBOLS;

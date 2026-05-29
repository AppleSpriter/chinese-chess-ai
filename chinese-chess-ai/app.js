const RED = "red";
const BLACK = "black";
const TYPES = {
  K: "K",
  A: "A",
  B: "B",
  N: "N",
  R: "R",
  C: "C",
  P: "P",
};

const PIECE_TEXT = {
  red: { K: "帅", A: "仕", B: "相", N: "马", R: "车", C: "炮", P: "兵" },
  black: { K: "将", A: "士", B: "象", N: "马", R: "车", C: "砲", P: "卒" },
};

const PIECE_NAME = {
  K: "将帅",
  A: "士仕",
  B: "象相",
  N: "马",
  R: "车",
  C: "炮",
  P: "兵卒",
};

const PIECE_VALUE = {
  K: 100000,
  R: 900,
  C: 460,
  N: 420,
  B: 210,
  A: 210,
  P: 110,
};

const MATE_SCORE = 1000000;
const FILE_NAMES = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

const boardEl = document.querySelector("#board");
const statusText = document.querySelector("#statusText");
const turnPill = document.querySelector("#turnPill");
const redWinBar = document.querySelector("#redWinBar");
const redWinText = document.querySelector("#redWinText");
const blackWinText = document.querySelector("#blackWinText");
const evalText = document.querySelector("#evalText");
const suggestionList = document.querySelector("#suggestionList");
const historyList = document.querySelector("#historyList");
const analysisState = document.querySelector("#analysisState");
const moveCount = document.querySelector("#moveCount");
const aiEnabledInput = document.querySelector("#aiEnabled");
const aiColorSelect = document.querySelector("#aiColor");
const depthRange = document.querySelector("#depthRange");
const depthValue = document.querySelector("#depthValue");
const newGameBtn = document.querySelector("#newGameBtn");
const undoBtn = document.querySelector("#undoBtn");
const aiMoveBtn = document.querySelector("#aiMoveBtn");
const flipBtn = document.querySelector("#flipBtn");

let state = {
  board: createInitialBoard(),
  turn: RED,
  selected: null,
  legalTargets: [],
  history: [],
  gameOver: false,
  winner: null,
  flipped: false,
  aiEnabled: true,
  aiColor: BLACK,
  thinking: false,
};

let analysisToken = 0;

function createInitialBoard() {
  const board = Array.from({ length: 10 }, () => Array(9).fill(null));
  const backRank = ["R", "N", "B", "A", "K", "A", "B", "N", "R"];

  backRank.forEach((type, x) => {
    board[0][x] = piece(BLACK, type);
    board[9][x] = piece(RED, type);
  });

  board[2][1] = piece(BLACK, "C");
  board[2][7] = piece(BLACK, "C");
  board[7][1] = piece(RED, "C");
  board[7][7] = piece(RED, "C");

  [0, 2, 4, 6, 8].forEach((x) => {
    board[3][x] = piece(BLACK, "P");
    board[6][x] = piece(RED, "P");
  });

  return board;
}

function piece(color, type) {
  return { color, type };
}

function cloneBoard(board) {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function opponent(color) {
  return color === RED ? BLACK : RED;
}

function colorName(color) {
  return color === RED ? "红方" : "黑方";
}

function inBounds(x, y) {
  return x >= 0 && x < 9 && y >= 0 && y < 10;
}

function inPalace(color, x, y) {
  if (x < 3 || x > 5) return false;
  return color === RED ? y >= 7 && y <= 9 : y >= 0 && y <= 2;
}

function crossedRiver(color, y) {
  return color === RED ? y <= 4 : y >= 5;
}

function sameSideOfRiver(color, y) {
  return color === RED ? y >= 5 : y <= 4;
}

function getPiece(board, x, y) {
  if (!inBounds(x, y)) return null;
  return board[y][x];
}

function isOwn(board, color, x, y) {
  const target = getPiece(board, x, y);
  return Boolean(target && target.color === color);
}

function pushIfValid(board, moves, fromX, fromY, toX, toY) {
  if (!inBounds(toX, toY)) return;
  const moving = board[fromY][fromX];
  const target = board[toY][toX];
  if (!target || target.color !== moving.color) {
    moves.push({ fromX, fromY, toX, toY, capture: target ? { ...target } : null });
  }
}

function pseudoMovesForPiece(board, x, y) {
  const moving = board[y][x];
  if (!moving) return [];
  const moves = [];
  const { color, type } = moving;

  if (type === TYPES.K) {
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([dx, dy]) => {
      const toX = x + dx;
      const toY = y + dy;
      if (inPalace(color, toX, toY)) pushIfValid(board, moves, x, y, toX, toY);
    });

    for (const dy of [-1, 1]) {
      let scanY = y + dy;
      while (inBounds(x, scanY)) {
        const found = board[scanY][x];
        if (found) {
          if (found.type === TYPES.K && found.color !== color) {
            pushIfValid(board, moves, x, y, x, scanY);
          }
          break;
        }
        scanY += dy;
      }
    }
  }

  if (type === TYPES.A) {
    [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ].forEach(([dx, dy]) => {
      const toX = x + dx;
      const toY = y + dy;
      if (inPalace(color, toX, toY)) pushIfValid(board, moves, x, y, toX, toY);
    });
  }

  if (type === TYPES.B) {
    [
      [2, 2],
      [2, -2],
      [-2, 2],
      [-2, -2],
    ].forEach(([dx, dy]) => {
      const eyeX = x + dx / 2;
      const eyeY = y + dy / 2;
      const toX = x + dx;
      const toY = y + dy;
      if (inBounds(toX, toY) && sameSideOfRiver(color, toY) && !board[eyeY][eyeX]) {
        pushIfValid(board, moves, x, y, toX, toY);
      }
    });
  }

  if (type === TYPES.N) {
    [
      [1, 2, 0, 1],
      [-1, 2, 0, 1],
      [1, -2, 0, -1],
      [-1, -2, 0, -1],
      [2, 1, 1, 0],
      [2, -1, 1, 0],
      [-2, 1, -1, 0],
      [-2, -1, -1, 0],
    ].forEach(([dx, dy, legX, legY]) => {
      if (!getPiece(board, x + legX, y + legY)) {
        pushIfValid(board, moves, x, y, x + dx, y + dy);
      }
    });
  }

  if (type === TYPES.R || type === TYPES.C) {
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([dx, dy]) => {
      let toX = x + dx;
      let toY = y + dy;
      let screenFound = false;

      while (inBounds(toX, toY)) {
        const target = board[toY][toX];

        if (type === TYPES.R) {
          if (!target) {
            moves.push({ fromX: x, fromY: y, toX, toY, capture: null });
          } else {
            if (target.color !== color) {
              moves.push({ fromX: x, fromY: y, toX, toY, capture: { ...target } });
            }
            break;
          }
        } else if (!screenFound) {
          if (!target) {
            moves.push({ fromX: x, fromY: y, toX, toY, capture: null });
          } else {
            screenFound = true;
          }
        } else if (target) {
          if (target.color !== color) {
            moves.push({ fromX: x, fromY: y, toX, toY, capture: { ...target } });
          }
          break;
        }

        toX += dx;
        toY += dy;
      }
    });
  }

  if (type === TYPES.P) {
    const forward = color === RED ? -1 : 1;
    pushIfValid(board, moves, x, y, x, y + forward);
    if (crossedRiver(color, y)) {
      pushIfValid(board, moves, x, y, x - 1, y);
      pushIfValid(board, moves, x, y, x + 1, y);
    }
  }

  return moves;
}

function generateLegalMoves(board, color) {
  const moves = [];
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const p = board[y][x];
      if (!p || p.color !== color) continue;
      for (const move of pseudoMovesForPiece(board, x, y)) {
        const next = makeMoveOnBoard(board, move);
        if (!isInCheck(next, color)) {
          moves.push(move);
        }
      }
    }
  }
  return moves;
}

function legalMovesForSquare(board, color, x, y) {
  return generateLegalMoves(board, color).filter((move) => move.fromX === x && move.fromY === y);
}

function makeMoveOnBoard(board, move) {
  const next = cloneBoard(board);
  const moving = next[move.fromY][move.fromX];
  next[move.fromY][move.fromX] = null;
  next[move.toY][move.toX] = moving;
  return next;
}

function applyMove(move, source = "human") {
  if (state.gameOver) return;
  const moving = state.board[move.fromY][move.fromX];
  const captured = state.board[move.toY][move.toX];
  const record = {
    boardBefore: cloneBoard(state.board),
    turnBefore: state.turn,
    gameOverBefore: state.gameOver,
    winnerBefore: state.winner,
    move: { ...move, capture: captured ? { ...captured } : null },
    notation: formatMove({ ...move, capture: captured ? { ...captured } : null }, state.board),
    source,
  };

  state.board[move.toY][move.toX] = moving;
  state.board[move.fromY][move.fromX] = null;
  state.selected = null;
  state.legalTargets = [];
  state.history.push(record);

  const nextTurn = opponent(state.turn);
  state.turn = nextTurn;
  updateGameEnd(source);
  render();
  scheduleAnalysis();
  maybeScheduleAi();
}

function updateGameEnd() {
  const redKing = findKing(state.board, RED);
  const blackKing = findKing(state.board, BLACK);

  if (!redKing || !blackKing) {
    state.gameOver = true;
    state.winner = redKing ? RED : BLACK;
    return;
  }

  const moves = generateLegalMoves(state.board, state.turn);
  if (moves.length === 0) {
    state.gameOver = true;
    state.winner = opponent(state.turn);
  }
}

function findKing(board, color) {
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const p = board[y][x];
      if (p && p.color === color && p.type === TYPES.K) return { x, y };
    }
  }
  return null;
}

function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return true;
  const enemy = opponent(color);

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const p = board[y][x];
      if (p && p.color === enemy && canReach(board, x, y, king.x, king.y)) {
        return true;
      }
    }
  }
  return false;
}

function canReach(board, fromX, fromY, toX, toY) {
  if (!inBounds(fromX, fromY) || !inBounds(toX, toY)) return false;
  const moving = board[fromY][fromX];
  if (!moving) return false;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (moving.type === TYPES.K) {
    if (fromX === toX && clearLine(board, fromX, fromY, toX, toY)) return true;
    return absX + absY === 1 && inPalace(moving.color, toX, toY);
  }

  if (moving.type === TYPES.A) {
    return absX === 1 && absY === 1 && inPalace(moving.color, toX, toY);
  }

  if (moving.type === TYPES.B) {
    if (absX !== 2 || absY !== 2 || !sameSideOfRiver(moving.color, toY)) return false;
    return !board[fromY + dy / 2][fromX + dx / 2];
  }

  if (moving.type === TYPES.N) {
    if (!((absX === 1 && absY === 2) || (absX === 2 && absY === 1))) return false;
    const legX = absX === 2 ? Math.sign(dx) : 0;
    const legY = absY === 2 ? Math.sign(dy) : 0;
    return !board[fromY + legY][fromX + legX];
  }

  if (moving.type === TYPES.R) {
    return (fromX === toX || fromY === toY) && clearLine(board, fromX, fromY, toX, toY);
  }

  if (moving.type === TYPES.C) {
    if (fromX !== toX && fromY !== toY) return false;
    return countBetween(board, fromX, fromY, toX, toY) === 1;
  }

  if (moving.type === TYPES.P) {
    const forward = moving.color === RED ? -1 : 1;
    if (dx === 0 && dy === forward) return true;
    return crossedRiver(moving.color, fromY) && absX === 1 && dy === 0;
  }

  return false;
}

function clearLine(board, fromX, fromY, toX, toY) {
  return countBetween(board, fromX, fromY, toX, toY) === 0;
}

function countBetween(board, fromX, fromY, toX, toY) {
  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);
  let x = fromX + stepX;
  let y = fromY + stepY;
  let count = 0;

  while (x !== toX || y !== toY) {
    if (board[y][x]) count += 1;
    x += stepX;
    y += stepY;
  }

  return count;
}

function evaluateBoard(board) {
  const redKing = findKing(board, RED);
  const blackKing = findKing(board, BLACK);
  if (!redKing) return -MATE_SCORE;
  if (!blackKing) return MATE_SCORE;

  let score = 0;

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const p = board[y][x];
      if (!p) continue;
      const sign = p.color === RED ? 1 : -1;
      score += sign * (PIECE_VALUE[p.type] + positionalBonus(p, x, y));
    }
  }

  if (isInCheck(board, RED)) score -= 55;
  if (isInCheck(board, BLACK)) score += 55;
  return score;
}

function positionalBonus(pieceData, x, y) {
  const normalizedY = pieceData.color === RED ? 9 - y : y;
  const centerDistance = Math.abs(4 - x);

  if (pieceData.type === TYPES.P) {
    return normalizedY * 13 + (crossedRiver(pieceData.color, y) ? 70 : 0) - centerDistance * 4;
  }

  if (pieceData.type === TYPES.N) {
    return 38 - centerDistance * 9 - Math.abs(4.5 - y) * 4;
  }

  if (pieceData.type === TYPES.C) {
    return 22 - centerDistance * 4 + normalizedY * 2;
  }

  if (pieceData.type === TYPES.R) {
    return 18 - centerDistance * 3 + normalizedY * 2;
  }

  if (pieceData.type === TYPES.K) {
    return -Math.abs(4 - x) * 6;
  }

  return 0;
}

function findBestMoves(board, color, depth, maxLines = 3) {
  const start = performance.now();
  const moves = orderMoves(generateLegalMoves(board, color), board);
  const lines = [];
  let nodes = 0;

  if (moves.length === 0) {
    return {
      bestMove: null,
      lines: [],
      score: color === RED ? -MATE_SCORE : MATE_SCORE,
      nodes,
      elapsed: performance.now() - start,
    };
  }

  for (const move of moves) {
    const next = makeMoveOnBoard(board, move);
    const result = search(next, opponent(color), depth - 1, -MATE_SCORE, MATE_SCORE, 1);
    nodes += result.nodes;
    lines.push({ move, score: result.score });
  }

  lines.sort((a, b) => (color === RED ? b.score - a.score : a.score - b.score));

  return {
    bestMove: lines[0].move,
    lines: lines.slice(0, maxLines),
    score: lines[0].score,
    nodes,
    elapsed: performance.now() - start,
  };
}

function search(board, color, depth, alpha, beta, ply) {
  const redKing = findKing(board, RED);
  const blackKing = findKing(board, BLACK);
  if (!redKing) return { score: -MATE_SCORE + ply, nodes: 1 };
  if (!blackKing) return { score: MATE_SCORE - ply, nodes: 1 };

  if (depth <= 0) {
    return { score: evaluateBoard(board), nodes: 1 };
  }

  const moves = orderMoves(generateLegalMoves(board, color), board);
  if (moves.length === 0) {
    return {
      score: color === RED ? -MATE_SCORE + ply : MATE_SCORE - ply,
      nodes: 1,
    };
  }

  let nodes = 1;

  if (color === RED) {
    let best = -MATE_SCORE;
    for (const move of moves) {
      const result = search(makeMoveOnBoard(board, move), BLACK, depth - 1, alpha, beta, ply + 1);
      nodes += result.nodes;
      best = Math.max(best, result.score);
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return { score: best, nodes };
  }

  let best = MATE_SCORE;
  for (const move of moves) {
    const result = search(makeMoveOnBoard(board, move), RED, depth - 1, alpha, beta, ply + 1);
    nodes += result.nodes;
    best = Math.min(best, result.score);
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return { score: best, nodes };
}

function orderMoves(moves, board) {
  return [...moves].sort((a, b) => movePriority(b, board) - movePriority(a, board));
}

function movePriority(move, board) {
  const target = board[move.toY][move.toX];
  const moving = board[move.fromY][move.fromX];
  let score = 0;
  if (target) score += PIECE_VALUE[target.type] * 10 - PIECE_VALUE[moving.type];
  if (moving.type === TYPES.P && crossedRiver(moving.color, move.toY)) score += 30;
  if (moving.type === TYPES.R || moving.type === TYPES.C) score += 5;
  return score;
}

function scoreToWinRate(score) {
  if (score > 900000) return 99;
  if (score < -900000) return 1;
  return Math.round(100 / (1 + Math.exp(-score / 520)));
}

function scoreText(score) {
  if (score > 900000) return "红方胜势";
  if (score < -900000) return "黑方胜势";
  if (Math.abs(score) < 35) return "均势";
  const lead = score > 0 ? "红优" : "黑优";
  return `${lead} ${Math.abs(score / 100).toFixed(1)}`;
}

function scheduleAnalysis() {
  const token = (analysisToken += 1);
  analysisState.textContent = "计算中";

  window.setTimeout(() => {
    if (token !== analysisToken) return;
    const depth = Number(depthRange.value);
    const result = findBestMoves(cloneBoard(state.board), state.turn, depth, 3);
    if (token !== analysisToken) return;
    renderAnalysis(result);
  }, 30);
}

function renderAnalysis(result) {
  const score = result.score ?? evaluateBoard(state.board);
  const redWin = scoreToWinRate(score);
  redWinBar.style.width = `${redWin}%`;
  redWinText.textContent = `红方 ${redWin}%`;
  blackWinText.textContent = `黑方 ${100 - redWin}%`;
  evalText.textContent = scoreText(score);

  suggestionList.innerHTML = "";
  if (state.gameOver) {
    analysisState.textContent = "已结束";
    const li = document.createElement("li");
    li.innerHTML = `<div><b>${colorName(state.winner)}获胜</b><span>棋局已经结束。</span></div><em class="score-chip">${redWin}%</em>`;
    suggestionList.append(li);
    return;
  }

  analysisState.textContent = `${result.elapsed.toFixed(0)} ms`;
  if (result.lines.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<div><b>暂无合法走法</b><span>当前一方已经无棋可走。</span></div>`;
    suggestionList.append(li);
    return;
  }

  result.lines.forEach((line, index) => {
    const li = document.createElement("li");
    const moveLabel = formatMove(line.move, state.board);
    const win = scoreToWinRate(line.score);
    li.innerHTML = `
      <div>
        <b>${index + 1}. ${moveLabel}</b>
        <span>${scoreText(line.score)}，红方胜率 ${win}%</span>
      </div>
      <em class="score-chip">${formatSignedScore(line.score)}</em>
    `;
    suggestionList.append(li);
  });
}

function formatSignedScore(score) {
  if (score > 900000) return "+M";
  if (score < -900000) return "-M";
  return `${score >= 0 ? "+" : ""}${(score / 100).toFixed(1)}`;
}

function maybeScheduleAi() {
  if (!state.aiEnabled || state.gameOver || state.thinking || state.turn !== state.aiColor) return;
  state.thinking = true;
  renderStatus();

  window.setTimeout(() => {
    const depth = Number(depthRange.value);
    const result = findBestMoves(cloneBoard(state.board), state.turn, depth, 1);
    state.thinking = false;
    if (!state.gameOver && result.bestMove && state.turn === state.aiColor) {
      applyMove(result.bestMove, "ai");
    } else {
      renderStatus();
    }
  }, 120);
}

function render() {
  renderBoard();
  renderStatus();
  renderHistory();
}

function renderBoard() {
  boardEl.innerHTML = boardSvg();
  const pointLayer = document.createElement("div");
  pointLayer.className = "point-layer";
  const legalKeys = new Map(state.legalTargets.map((m) => [`${m.toX},${m.toY}`, m]));
  const redKing = findKing(state.board, RED);
  const blackKing = findKing(state.board, BLACK);
  const redInCheck = redKing && isInCheck(state.board, RED);
  const blackInCheck = blackKing && isInCheck(state.board, BLACK);

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const displayX = state.flipped ? 8 - x : x;
      const displayY = state.flipped ? 9 - y : y;
      const p = state.board[y][x];
      const key = `${x},${y}`;
      const point = document.createElement("button");
      point.type = "button";
      point.className = "point";
      point.dataset.x = x;
      point.dataset.y = y;
      point.style.setProperty("--x", displayX);
      point.style.setProperty("--y", displayY);
      point.setAttribute("aria-label", pointLabel(x, y, p));

      if (state.selected && state.selected.x === x && state.selected.y === y) {
        point.classList.add("selected");
      }
      if (legalKeys.has(key)) {
        point.classList.add("legal");
        if (p) point.classList.add("capture");
      }
      if ((p?.color === RED && p.type === TYPES.K && redInCheck) || (p?.color === BLACK && p.type === TYPES.K && blackInCheck)) {
        point.classList.add("check");
      }

      if (p) {
        const pieceNode = document.createElement("span");
        pieceNode.className = `piece ${p.color}`;
        pieceNode.textContent = PIECE_TEXT[p.color][p.type];
        point.append(pieceNode);
      }

      pointLayer.append(point);
    }
  }

  boardEl.append(pointLayer);
}

function boardSvg() {
  const horizontal = Array.from({ length: 10 }, (_, y) => `<line class="${y === 0 || y === 9 ? "outer" : ""}" x1="0" y1="${y}" x2="8" y2="${y}" />`).join("");
  const vertical = Array.from({ length: 9 }, (_, x) => {
    if (x === 0 || x === 8) return `<line class="outer" x1="${x}" y1="0" x2="${x}" y2="9" />`;
    return `<line x1="${x}" y1="0" x2="${x}" y2="4" /><line x1="${x}" y1="5" x2="${x}" y2="9" />`;
  }).join("");
  const palace = `
    <line x1="3" y1="0" x2="5" y2="2" />
    <line x1="5" y1="0" x2="3" y2="2" />
    <line x1="3" y1="7" x2="5" y2="9" />
    <line x1="5" y1="7" x2="3" y2="9" />
  `;

  return `
    <svg class="board-lines" viewBox="0 0 8 9" preserveAspectRatio="none" aria-hidden="true">
      ${horizontal}${vertical}${palace}
    </svg>
    <div class="river" aria-hidden="true"><span>楚河</span><span>汉界</span></div>
  `;
}

function pointLabel(x, y, p) {
  const base = `${x + 1} 路 ${y + 1} 行`;
  if (!p) return base;
  return `${base} ${colorName(p.color)}${PIECE_NAME[p.type]}`;
}

function renderStatus() {
  turnPill.textContent = colorName(state.turn);
  turnPill.classList.toggle("red", state.turn === RED);
  turnPill.classList.toggle("black", state.turn === BLACK);
  aiMoveBtn.disabled = state.gameOver || state.thinking;
  undoBtn.disabled = state.history.length === 0 || state.thinking;

  if (state.gameOver) {
    statusText.textContent = `${colorName(state.winner)}获胜`;
    return;
  }

  if (state.thinking) {
    statusText.textContent = `${colorName(state.turn)} AI 思考中`;
    return;
  }

  const checkText = isInCheck(state.board, state.turn) ? "，被将军" : "";
  const aiText = state.aiEnabled && state.turn === state.aiColor ? "，AI 待走" : "";
  statusText.textContent = `${colorName(state.turn)}行棋${checkText}${aiText}`;
}

function renderHistory() {
  moveCount.textContent = `${state.history.length} 手`;
  historyList.innerHTML = "";

  state.history.forEach((entry) => {
    const li = document.createElement("li");
    const source = entry.source === "ai" ? "AI" : "玩家";
    li.innerHTML = `<strong>${entry.notation}</strong><span>${source}</span>`;
    historyList.append(li);
  });

  historyList.scrollTop = historyList.scrollHeight;
}

function formatMove(move, boardBefore) {
  const moving = boardBefore[move.fromY][move.fromX];
  const captured = boardBefore[move.toY][move.toX];
  if (!moving) return "未知走法";
  const from = `${FILE_NAMES[move.fromX]}路${move.fromY + 1}行`;
  const to = `${FILE_NAMES[move.toX]}路${move.toY + 1}行`;
  const captureText = captured ? `，吃${PIECE_TEXT[captured.color][captured.type]}` : "";
  return `${colorName(moving.color)}${PIECE_TEXT[moving.color][moving.type]} ${from} 到 ${to}${captureText}`;
}

function handlePointClick(event) {
  const point = event.target.closest(".point");
  if (!point || state.gameOver || state.thinking) return;
  if (state.aiEnabled && state.turn === state.aiColor) return;

  const x = Number(point.dataset.x);
  const y = Number(point.dataset.y);
  const clickedPiece = state.board[y][x];

  if (state.selected) {
    const legal = state.legalTargets.find((move) => move.toX === x && move.toY === y);
    if (legal) {
      applyMove(legal, "human");
      return;
    }
  }

  if (clickedPiece && clickedPiece.color === state.turn) {
    state.selected = { x, y };
    state.legalTargets = legalMovesForSquare(state.board, state.turn, x, y);
  } else {
    state.selected = null;
    state.legalTargets = [];
  }

  render();
}

function resetGame() {
  state = {
    board: createInitialBoard(),
    turn: RED,
    selected: null,
    legalTargets: [],
    history: [],
    gameOver: false,
    winner: null,
    flipped: state.flipped,
    aiEnabled: aiEnabledInput.checked,
    aiColor: aiColorSelect.value,
    thinking: false,
  };
  render();
  scheduleAnalysis();
  maybeScheduleAi();
}

function undoMove() {
  if (state.history.length === 0 || state.thinking) return;
  const steps = state.aiEnabled && state.history.length >= 2 ? 2 : 1;
  for (let i = 0; i < steps; i += 1) {
    const last = state.history.pop();
    if (!last) break;
    state.board = cloneBoard(last.boardBefore);
    state.turn = last.turnBefore;
    state.gameOver = last.gameOverBefore;
    state.winner = last.winnerBefore;
  }
  state.selected = null;
  state.legalTargets = [];
  render();
  scheduleAnalysis();
}

function makeAiMoveForCurrentSide() {
  if (state.gameOver || state.thinking) return;
  state.thinking = true;
  renderStatus();

  window.setTimeout(() => {
    const result = findBestMoves(cloneBoard(state.board), state.turn, Number(depthRange.value), 1);
    state.thinking = false;
    if (result.bestMove) {
      applyMove(result.bestMove, "ai");
    } else {
      renderStatus();
    }
  }, 60);
}

boardEl.addEventListener("click", handlePointClick);
newGameBtn.addEventListener("click", resetGame);
undoBtn.addEventListener("click", undoMove);
aiMoveBtn.addEventListener("click", makeAiMoveForCurrentSide);
flipBtn.addEventListener("click", () => {
  state.flipped = !state.flipped;
  renderBoard();
});

aiEnabledInput.addEventListener("change", () => {
  state.aiEnabled = aiEnabledInput.checked;
  renderStatus();
  maybeScheduleAi();
});

aiColorSelect.addEventListener("change", () => {
  state.aiColor = aiColorSelect.value;
  renderStatus();
  maybeScheduleAi();
});

depthRange.addEventListener("input", () => {
  depthValue.textContent = depthRange.value;
  scheduleAnalysis();
});

window.__xiangqiDebug = {
  get state() {
    return state;
  },
  generateLegalMoves,
  evaluateBoard,
  findBestMoves,
  createInitialBoard,
};

render();
scheduleAnalysis();

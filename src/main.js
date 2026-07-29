"use strict";

const CUSTOM_API_URL = window.LOTTO_API_URL || "";
const LOTTO_STATUS_URL = CUSTOM_API_URL.replace(/\/generate-custom\/?$/, "/lotto-status");
const state = {
  auto: [],
  custom: [],
};

const elements = {
  auto: {
    count: document.querySelector("#auto-count"),
    generate: document.querySelector("#auto-generate"),
    result: document.querySelector("#auto-result"),
    copy: document.querySelector("#auto-copy"),
    reset: document.querySelector("#auto-reset"),
  },
  custom: {
    count: document.querySelector("#custom-count"),
    generate: document.querySelector("#custom-generate"),
    result: document.querySelector("#custom-result"),
    copy: document.querySelector("#custom-copy"),
    reset: document.querySelector("#custom-reset"),
  },
  toast: document.querySelector("#toast"),
  latestDraw: document.querySelector("#latest-draw"),
  winningTracker: document.querySelector("#winning-tracker"),
};

const EMPTY_MARKUP = `
  <div class="empty-state">
    <span class="empty-icon" aria-hidden="true">＋</span>
    <strong>아직 생성된 번호가 없습니다.</strong>
    <span>게임 수를 선택하고 생성 버튼을 눌러주세요.</span>
  </div>
`;

function secureRandomInt(max) {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError("max는 양의 정수여야 합니다.");
  }

  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  let value;

  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);

  return value % max;
}

function createRandomGame() {
  const pool = Array.from({ length: 45 }, (_, index) => index + 1);

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomInt(index + 1);
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, 6).sort((a, b) => a - b);
}

function createRandomGames(gameCount) {
  const games = [];
  const seen = new Set();

  while (games.length < gameCount) {
    const game = createRandomGame();
    const key = game.join("-");
    if (!seen.has(key)) {
      seen.add(key);
      games.push(game);
    }
  }

  return games;
}

function ballRange(number) {
  if (number <= 10) return "range-1";
  if (number <= 20) return "range-2";
  if (number <= 30) return "range-3";
  if (number <= 40) return "range-4";
  return "range-5";
}

function renderBall(number, extraClass = "") {
  return `<span class="ball ${ballRange(number)} ${extraClass}" aria-hidden="true">${number}</span>`;
}

function isValidGames(games, expectedCount) {
  if (!Array.isArray(games) || games.length !== expectedCount) return false;

  const combinations = new Set();
  for (const game of games) {
    if (!Array.isArray(game) || game.length !== 6) return false;
    if (!game.every((number) => Number.isInteger(number) && number >= 1 && number <= 45)) {
      return false;
    }
    if (new Set(game).size !== 6) return false;
    if (game.some((number, index) => index > 0 && number <= game[index - 1])) return false;

    const key = game.join("-");
    if (combinations.has(key)) return false;
    combinations.add(key);
  }

  return true;
}

function renderGames(type, games, message = "") {
  const rows = games
    .map(
      (game, index) => `
        <div class="game-row">
          <span class="game-label">G${String(index + 1).padStart(2, "0")}</span>
          <div class="balls" aria-label="${index + 1}게임 번호 ${game.join(", ")}">
            ${game
              .map(
                (number) =>
                  `<span class="ball ${ballRange(number)}" aria-hidden="true">${number}</span>`,
              )
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");

  elements[type].result.innerHTML = `
    <div class="game-list">${rows}</div>
    ${message ? `<p class="result-message">${escapeHtml(message)}</p>` : ""}
  `;
  elements[type].copy.disabled = false;
  elements[type].reset.disabled = false;
}

async function revealCustomGames(games, message) {
  elements.custom.result.innerHTML = `
    <div class="reveal-stage">
      <div class="reveal-heading">
        <span class="reveal-signal" aria-hidden="true"><i></i><i></i><i></i></span>
        <div>
          <strong>AI 리온번호 완성 단계</strong>
          <span id="reveal-progress">최종 조합을 순서대로 공개합니다.</span>
        </div>
        <b id="reveal-count">0 / ${games.length}</b>
      </div>
      <div class="game-list reveal-list"></div>
    </div>
  `;

  const list = elements.custom.result.querySelector(".reveal-list");
  const count = elements.custom.result.querySelector("#reveal-count");
  const progress = elements.custom.result.querySelector("#reveal-progress");

  for (let index = 0; index < games.length; index += 1) {
    const game = games[index];
    const row = document.createElement("div");
    row.className = "game-row reveal-game";
    row.innerHTML = `
      <span class="game-label">G${String(index + 1).padStart(2, "0")}</span>
      <div class="balls" aria-label="${index + 1}게임 번호 ${game.join(", ")}">
        ${game
          .map(
            (number, ballIndex) =>
              `<span class="ball ${ballRange(number)} reveal-ball" style="--ball-delay: ${
                ballIndex * 55
              }ms" aria-hidden="true">${number}</span>`,
          )
          .join("")}
      </div>
      <span class="reveal-check" aria-hidden="true">✓</span>
    `;
    list.appendChild(row);
    count.textContent = `${index + 1} / ${games.length}`;
    progress.textContent = `${index + 1}게임 조합 공개 완료`;
    await wait(520);
  }

  const finalMessage = document.createElement("p");
  finalMessage.className = "result-message reveal-message";
  finalMessage.textContent = message || "AI 리온번호가 생성되었습니다.";
  elements.custom.result.appendChild(finalMessage);
  elements.custom.copy.disabled = false;
  elements.custom.reset.disabled = false;
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = String(value);
  return span.innerHTML;
}

function setLoading(type, loading) {
  const button = elements[type].generate;
  button.disabled = loading;
  elements[type].count.disabled = loading;

  if (loading) {
    button.dataset.label = button.textContent;
    button.textContent = type === "custom" ? "AI 조합 생성 중..." : "생성 중...";
    elements[type].result.innerHTML =
      type === "custom"
        ? `
          <div class="loading-state ai-loading-state">
            <div class="ai-orbit" aria-hidden="true">
              <span class="ai-core">AI</span>
              <span class="orbit-ball orbit-ball-1">6</span>
              <span class="orbit-ball orbit-ball-2">45</span>
              <span class="orbit-ball orbit-ball-3">+</span>
            </div>
            <strong>AI가 리온번호를 생성하고 있습니다.</strong>
            <span class="loading-step">비공개 조합 엔진에서 최종 번호를 구성하는 중입니다.</span>
            <span class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          </div>
        `
        : `
          <div class="loading-state">
            <span class="loading-spinner" aria-hidden="true"></span>
            <strong>번호를 만들고 있습니다.</strong>
            <span>잠시만 기다려 주세요.</span>
          </div>
        `;
  } else {
    button.textContent = button.dataset.label || "리온번호 생성";
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function showError(type, message) {
  elements[type].result.innerHTML = `
    <div class="error-state">
      <span class="empty-icon" aria-hidden="true">!</span>
      <strong>번호를 생성하지 못했습니다.</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function reset(type) {
  state[type] = [];
  elements[type].result.innerHTML = EMPTY_MARKUP;
  elements[type].copy.disabled = true;
  elements[type].reset.disabled = true;
}

function showToast(message) {
  window.clearTimeout(showToast.timer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

function formatDrawDate(value) {
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${year}.${month}.${day}` : value;
}

function renderLottoStatus(data) {
  const draw = data.latestDraw;
  const winnerCounts = [1, 2, 3, 4, 5]
    .map(
      (rank) => `
        <span>
          <span>${rank}등</span>
          <strong>${Number(draw.winners[rank] || 0).toLocaleString("ko-KR")}명</strong>
        </span>
      `,
    )
    .join("");

  elements.latestDraw.innerHTML = `
    <div class="preview-top">
      <span>제${draw.round}회 당첨결과</span>
      <span class="status-dot">${formatDrawDate(draw.date)}</span>
    </div>
    <div class="preview-game">
      <span class="preview-label">이번 주 당첨번호</span>
      <div class="draw-result-line">
        <div class="balls">${draw.numbers.map((number) => renderBall(number)).join("")}</div>
        <span class="plus-mark" aria-hidden="true">+</span>
        <div class="hero-bonus">
          ${renderBall(draw.bonus, "bonus-ball")}
          <small>보너스</small>
        </div>
      </div>
    </div>
    <div class="hero-winner-counts">
      ${winnerCounts}
    </div>
    <div class="preview-note">
      <span>당첨자 수</span>
      <a href="https://www.dhlottery.co.kr/" target="_blank" rel="noopener noreferrer">공식 결과 확인</a>
    </div>
  `;

  const stats = [1, 2, 3, 4, 5]
    .map(
      (rank) => `
        <div class="rank-stat">
          <span>${rank}등</span>
          <strong>${Number(data.stats[rank] || 0).toLocaleString("ko-KR")}</strong>
        </div>
      `,
    )
    .join("");

  const summary = data.summary || {};
  const summaryCards = [
    ["검증 회차", `${Number(summary.verifiedRounds || 0).toLocaleString("ko-KR")}회`],
    ["생성 게임", `${Number(summary.generatedGames || 0).toLocaleString("ko-KR")}게임`],
    ["검증 완료", `${Number(summary.verifiedGames || 0).toLocaleString("ko-KR")}게임`],
    ["당첨 게임", `${Number(summary.winningGames || 0).toLocaleString("ko-KR")}게임`],
  ]
    .map(
      ([label, value]) => `
        <div class="summary-stat">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join("");

  const pending = data.pending?.length
    ? data.pending
        .map(
          (item) =>
            `<span class="pending-chip">${item.round}회 · ${item.count}게임 검증 대기</span>`,
        )
        .join("")
    : `<span class="pending-chip neutral">현재 검증 대기 조합이 없습니다.</span>`;

  const rounds = Array.isArray(data.roundStats) ? data.roundStats : [];
  const roundOptions = rounds
    .map((item) => `<option value="${item.round}">제${item.round}회</option>`)
    .join("");

  elements.winningTracker.innerHTML = `
    <div class="status-card-heading">
      <div>
        <span class="status-kicker">테스트 회원 전용</span>
        <h3>리온번호 검증 통계</h3>
      </div>
      <label class="round-filter-label">
        <span>회차 선택</span>
        <select id="round-filter">
          <option value="all">전체 누적</option>
          ${roundOptions}
        </select>
      </label>
    </div>
    <div class="summary-stats">${summaryCards}</div>
    <div class="stat-section-title">
      <strong id="rank-summary-title">전체 누적 당첨</strong>
      <span>검증 완료 번호 기준</span>
    </div>
    <div class="rank-stats" id="rank-stats">${stats}</div>
    <div class="pending-list">${pending}</div>
    <div class="round-breakdown" id="round-breakdown"></div>
    <div class="winning-history" id="winning-history"></div>
    <p class="tracking-note">
      낙첨 번호는 보존하지 않으며, 회차별 생성·검증 건수와 1~5등 당첨 기록만 누적합니다.
    </p>
  `;

  const filter = elements.winningTracker.querySelector("#round-filter");
  const rankStats = elements.winningTracker.querySelector("#rank-stats");
  const rankTitle = elements.winningTracker.querySelector("#rank-summary-title");
  const breakdown = elements.winningTracker.querySelector("#round-breakdown");
  const historyContainer = elements.winningTracker.querySelector("#winning-history");

  const renderRankStats = (rankData) =>
    [1, 2, 3, 4, 5]
      .map(
        (rank) => `
          <div class="rank-stat">
            <span>${rank}등</span>
            <strong>${Number(rankData?.[rank] || 0).toLocaleString("ko-KR")}</strong>
          </div>
        `,
      )
      .join("");

  const renderFilteredRecords = (selectedRound) => {
    const selected =
      selectedRound === "all"
        ? null
        : rounds.find((item) => String(item.round) === selectedRound);
    const visibleHistory = (data.winningHistory || []).filter(
      (item) => !selected || item.round === selected.round,
    );

    rankTitle.textContent = selected ? `제${selected.round}회 당첨` : "전체 누적 당첨";
    rankStats.innerHTML = renderRankStats(selected ? selected.ranks : data.stats);

    breakdown.innerHTML = selected
      ? `
        <div class="round-summary">
          <strong>제${selected.round}회 검증 결과</strong>
          <span>생성 ${selected.generatedGames.toLocaleString("ko-KR")}게임</span>
          <span>검증 ${selected.verifiedGames.toLocaleString("ko-KR")}게임</span>
        </div>
      `
      : rounds.length
        ? `
          <div class="round-summary">
            <strong>최근 ${rounds.length.toLocaleString("ko-KR")}회차 기록</strong>
            <span>회차 선택으로 상세 결과를 확인하세요.</span>
          </div>
        `
        : "";

    historyContainer.innerHTML = visibleHistory.length
      ? visibleHistory
          .map(
            (item) => `
              <div class="winning-record">
                <strong>제${item.round}회 ${item.rank}등</strong>
                <div class="balls">
                  ${item.numbers.map((number) => renderBall(number)).join("")}
                </div>
              </div>
            `,
          )
          .join("")
      : `
        <div class="history-empty">
          <strong>${selected ? `제${selected.round}회 당첨 기록이 없습니다.` : "아직 확정된 당첨 기록이 없습니다."}</strong>
          <span>${selected ? `${selected.verifiedGames.toLocaleString("ko-KR")}게임 검증 완료` : `${data.nextRound}회부터 실제 추첨 결과로 검증합니다.`}</span>
        </div>
      `;
  };

  filter.addEventListener("change", () => renderFilteredRecords(filter.value));
  renderFilteredRecords("all");
}

function renderStatusError() {
  const markup = `
    <div class="status-error">
      <strong>추첨 정보를 불러오지 못했습니다.</strong>
      <span>잠시 후 새로고침해 주세요.</span>
    </div>
  `;
  elements.latestDraw.innerHTML = markup;
  elements.winningTracker.innerHTML = markup;
}

async function loadLottoStatus() {
  if (!LOTTO_STATUS_URL) return;
  try {
    const response = await fetch(LOTTO_STATUS_URL);
    const data = await response.json();
    if (!response.ok || !data?.ok) throw new Error();
    renderLottoStatus(data);
  } catch {
    renderStatusError();
  }
}

async function copyGames(type) {
  if (!state[type].length) return;

  const text = state[type]
    .map((game, index) => `${String(index + 1).padStart(2, "0")}게임: ${game.join(", ")}`)
    .join("\n");

  try {
    await navigator.clipboard.writeText(text);
    showToast("전체 번호를 복사했습니다.");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    showToast("전체 번호를 복사했습니다.");
  }
}

function handleAutoGenerate() {
  const gameCount = Number(elements.auto.count.value);
  const games = createRandomGames(gameCount);
  state.auto = games;
  renderGames("auto", games, `${gameCount}게임 자동번호가 생성되었습니다.`);
}

async function handleCustomGenerate() {
  const gameCount = Number(elements.custom.count.value);

  if (!CUSTOM_API_URL || CUSTOM_API_URL.includes("YOUR-WORKER")) {
    showError("custom", "운영자가 서버 API 주소를 연결한 뒤 이용할 수 있습니다.");
    return;
  }

  setLoading("custom", true);
  const loadingStartedAt = performance.now();

  try {
    const response = await fetch(CUSTOM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameCount }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.message || "서버 요청을 처리하지 못했습니다.");
    }
    if (!isValidGames(data.games, gameCount)) {
      throw new Error("서버에서 올바르지 않은 번호 형식이 반환되었습니다.");
    }

    const remainingLoadingTime = Math.max(0, 1800 - (performance.now() - loadingStartedAt));
    await wait(remainingLoadingTime);
    state.custom = data.games;
    await revealCustomGames(
      data.games,
      data.targetRound
        ? `${data.targetRound}회 검증 대상으로 DB에 기록했습니다.`
        : data.message || "AI 리온번호가 생성되었습니다.",
    );
    await loadLottoStatus();
  } catch (error) {
    const message =
      error instanceof TypeError
        ? "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."
        : error.message;
    showError("custom", message);
  } finally {
    setLoading("custom", false);
  }
}

elements.auto.generate.addEventListener("click", handleAutoGenerate);
elements.custom.generate.addEventListener("click", handleCustomGenerate);
elements.auto.copy.addEventListener("click", () => copyGames("auto"));
elements.custom.copy.addEventListener("click", () => copyGames("custom"));
elements.auto.reset.addEventListener("click", () => reset("auto"));
elements.custom.reset.addEventListener("click", () => reset("custom"));

loadLottoStatus();

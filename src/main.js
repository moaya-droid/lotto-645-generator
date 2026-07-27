"use strict";

const CUSTOM_API_URL = window.LOTTO_API_URL || "";
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
    button.textContent = "생성 중...";
    elements[type].result.innerHTML = `
      <div class="loading-state">
        <span class="loading-spinner" aria-hidden="true"></span>
        <strong>번호를 만들고 있습니다.</strong>
        <span>잠시만 기다려 주세요.</span>
      </div>
    `;
  } else {
    button.textContent = button.dataset.label || "고유조합 생성";
  }
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

    state.custom = data.games;
    renderGames("custom", data.games, data.message || "고유조합 번호가 생성되었습니다.");
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

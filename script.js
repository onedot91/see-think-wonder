const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseTable = "stw_responses";
const supabaseRestUrl = buildSupabaseRestUrl(supabaseUrl);
const teacherPassword = "3300";
const seeItemCount = 2;

const elements = {
  roleView: document.querySelector("#roleView"),
  backendStatus: document.querySelector("#backendStatus"),
  backendStatusText: document.querySelector("#backendStatusText"),
  teacherView: document.querySelector("#teacherView"),
  studentView: document.querySelector("#studentView"),
  teacherRoleButton: document.querySelector("#teacherRoleButton"),
  studentRoleButton: document.querySelector("#studentRoleButton"),
  changeRoleButtons: document.querySelectorAll("[data-change-role]"),
  studentStepTitle: document.querySelector("#studentStepTitle"),
  studentForm: document.querySelector("#studentForm"),
  topPrevButton: document.querySelector("#topPrevButton"),
  topNextButton: document.querySelector("#topNextButton"),
  groupButtons: document.querySelectorAll(".group-button"),
  seeList: document.querySelector("#seeList"),
  thinkList: document.querySelector("#thinkList"),
  wonderList: document.querySelector("#wonderList"),
  reviewList: document.querySelector("#reviewList"),
  responseList: document.querySelector("#responseList"),
  emptyState: document.querySelector("#emptyState"),
  confirmModal: document.querySelector("#confirmModal"),
  modalSentenceList: document.querySelector("#modalSentenceList"),
  modalBackButton: document.querySelector("#modalBackButton"),
  modalSubmitButton: document.querySelector("#modalSubmitButton"),
  teacherPasswordModal: document.querySelector("#teacherPasswordModal"),
  teacherPasswordForm: document.querySelector("#teacherPasswordForm"),
  teacherPasswordInput: document.querySelector("#teacherPasswordInput"),
  teacherPasswordError: document.querySelector("#teacherPasswordError"),
  teacherPasswordCancelButton: document.querySelector("#teacherPasswordCancelButton"),
};

let responses = [];
let selectedGroup = "";
let currentStudentStep = "group";
let modalMode = "student";
let teacherPollId = null;
let isBackendOnline = false;

initResponses();

elements.teacherRoleButton.addEventListener("click", () => openTeacherPasswordModal());
elements.studentRoleButton.addEventListener("click", () => showStudentView());

elements.changeRoleButtons.forEach((button) => {
  button.addEventListener("click", () => showRoleView());
});

elements.groupButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedGroup = button.dataset.group;
    elements.groupButtons.forEach((item) => {
      item.classList.toggle("is-selected", item === button);
    });
  });
});

elements.studentForm.addEventListener("input", (event) => {
  if (event.target instanceof HTMLTextAreaElement) {
    resizeTextarea(event.target);
  }
});

elements.topPrevButton.addEventListener("click", () => {
  goToPreviousStudentStep();
});

elements.topNextButton.addEventListener("click", () => {
  goToNextStudentStep();
});

elements.studentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitStudentResponse();
});

elements.modalBackButton.addEventListener("click", () => {
  closeConfirmModal();
  focusFirstWonderInput();
});

elements.modalSubmitButton.addEventListener("click", () => {
  if (modalMode === "teacher") {
    closeConfirmModal();
    return;
  }

  submitStudentResponse();
});

elements.confirmModal.addEventListener("click", (event) => {
  if (event.target === elements.confirmModal) {
    closeConfirmModal();
  }
});

elements.teacherPasswordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitTeacherPassword();
});

elements.teacherPasswordCancelButton.addEventListener("click", () => {
  closeTeacherPasswordModal();
});

elements.teacherPasswordInput.addEventListener("input", () => {
  elements.teacherPasswordError.hidden = true;
  elements.teacherPasswordError.textContent = "";
});

elements.teacherPasswordModal.addEventListener("click", (event) => {
  if (event.target === elements.teacherPasswordModal) {
    closeTeacherPasswordModal();
  }
});

async function submitStudentResponse() {
  const seeItems = getSeeItems();
  const thoughts = getThoughtItems();
  const thinkSentences = buildThinkSentences(seeItems, thoughts);
  const wonderItems = getWonderItems();

  const response = {
    id: createId(),
    name: `${getGroupNumber()}모둠`,
    see: seeItems,
    think: thoughts,
    wonder: wonderItems,
    createdAt: new Date().toISOString(),
  };

  if (
    !response.name ||
    seeItems.length === 0 ||
    thoughts.some((text) => !text) ||
    wonderItems.length !== thinkSentences.length ||
    wonderItems.some((text) => !text)
  ) {
    showToast("빠진 내용이 있습니다.");
    return;
  }

  try {
    await addResponse(response);
  } catch {
    showToast("제출하지 못했습니다.");
    return;
  }
  renderResponses();
  resetStudentForm();
  closeConfirmModal();
  showToast("제출했습니다.");
  showRoleView();
}

function showRoleView() {
  stopTeacherPolling();
  closeConfirmModal();
  closeTeacherPasswordModal();
  elements.roleView.hidden = false;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = true;
}

function openTeacherPasswordModal() {
  elements.teacherPasswordInput.value = "";
  elements.teacherPasswordError.hidden = true;
  elements.teacherPasswordError.textContent = "";
  elements.teacherPasswordModal.hidden = false;
  elements.teacherPasswordInput.focus();
}

function closeTeacherPasswordModal() {
  elements.teacherPasswordModal.hidden = true;
  elements.teacherPasswordInput.value = "";
  elements.teacherPasswordError.hidden = true;
  elements.teacherPasswordError.textContent = "";
}

function submitTeacherPassword() {
  if (elements.teacherPasswordInput.value === teacherPassword) {
    closeTeacherPasswordModal();
    showTeacherView();
    return;
  }

  elements.teacherPasswordError.textContent = "비밀번호가 맞지 않습니다.";
  elements.teacherPasswordError.hidden = false;
  elements.teacherPasswordInput.select();
}

async function showTeacherView() {
  await refreshResponses();
  startTeacherPolling();
  elements.roleView.hidden = true;
  elements.teacherView.hidden = false;
  elements.studentView.hidden = true;
}

function showStudentView() {
  stopTeacherPolling();
  resetStudentForm();
  elements.roleView.hidden = true;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = false;
  elements.groupButtons[0]?.focus();
}

function showStudentStep(step) {
  let activeSection = null;
  currentStudentStep = step;

  document.querySelectorAll(".student-step").forEach((section) => {
    const isActive = section.dataset.step === step;
    section.hidden = !isActive;
    section.classList.remove("is-entering");

    if (isActive) {
      activeSection = section;
    }
  });

  const titles = {
    group: { icon: "", text: "모둠" },
    see: { icon: "👀", text: "식물에서 무엇을 볼 수 있나요?" },
    think: { icon: "🤔", text: "식물이 사는 곳에 어떤 도움이 될까요?" },
    wonder: { icon: "❓", text: "더 알고 싶은 점은 무엇인가요?" },
    review: { icon: "", text: "확인" },
  };
  const title = titles[step] || titles.group;
  elements.studentStepTitle.innerHTML = title.icon
    ? `<span class="step-title-icon" aria-hidden="true">${title.icon}</span><span class="step-title-text">${title.text}</span>`
    : `<span class="step-title-text">${title.text}</span>`;
  updateStudentTopActions(step);

  if (activeSection) {
    window.requestAnimationFrame(() => {
      activeSection.classList.add("is-entering");
    });
  }
}

function updateStudentTopActions(step) {
  const topActionByStep = {
    group: { prev: true, next: "다음" },
    see: { prev: true, next: "다음" },
    think: { prev: true, next: "다음" },
    wonder: { prev: true, next: "확인" },
    review: { prev: true, next: "제출" },
  };
  const action = topActionByStep[step] || topActionByStep.group;

  elements.topPrevButton.hidden = !action.prev;
  elements.topNextButton.textContent = action.next;
}

function goToPreviousStudentStep() {
  if (currentStudentStep === "group") {
    showRoleView();
    return;
  }

  if (currentStudentStep === "see") {
    showStudentStep("group");
    elements.groupButtons[0]?.focus();
    return;
  }

  if (currentStudentStep === "think") {
    showStudentStep("see");
    focusFirstSeeInput();
    return;
  }

  if (currentStudentStep === "wonder") {
    showStudentStep("think");
    focusFirstThinkInput();
    return;
  }

  if (currentStudentStep === "review") {
    showStudentStep("wonder");
    focusFirstWonderInput();
  }
}

function goToNextStudentStep() {
  if (currentStudentStep === "group") {
    goFromGroupToSee();
    return;
  }

  if (currentStudentStep === "see") {
    goFromSeeToThink();
    return;
  }

  if (currentStudentStep === "think") {
    goFromThinkToWonder();
    return;
  }

  if (currentStudentStep === "wonder") {
    openReviewModalFromWonder();
    return;
  }

  if (currentStudentStep === "review") {
    submitStudentResponse();
  }
}

function goFromGroupToSee() {
  if (!getGroupNumber()) {
    showToast("모둠을 골라 주세요.");
    return;
  }

  showStudentStep("see");
  focusFirstSeeInput();
}

function goFromSeeToThink() {
  const seeItems = getSeeItems();
  if (seeItems.length === 0) {
    showToast("보이는 것을 하나 이상 써 주세요.");
    return;
  }

  renderThinkRows(seeItems);
  showStudentStep("think");
  focusFirstThinkInput();
}

function goFromThinkToWonder() {
  const seeItems = getSeeItems();
  const thoughts = getThoughtItems();

  if (thoughts.length !== seeItems.length || thoughts.some((text) => !text)) {
    showToast("각 보기마다 생각을 써 주세요.");
    return;
  }

  renderWonderRows(seeItems, thoughts);
  showStudentStep("wonder");
  focusFirstWonderInput();
}

function openReviewModalFromWonder() {
  const seeItems = getSeeItems();
  const thoughts = getThoughtItems();
  const thinkSentences = buildThinkSentences(seeItems, thoughts);
  const wonderItems = getWonderItems();

  if (wonderItems.length !== thinkSentences.length || wonderItems.some((text) => !text)) {
    showToast("궁금한 것을 모두 써 주세요.");
    return;
  }

  openConfirmModal(seeItems, thoughts, wonderItems);
}

function getGroupNumber() {
  return selectedGroup;
}

function addSeeRow(value = "") {
  const row = document.createElement("div");
  const index = elements.seeList.querySelectorAll(".see-row").length + 1;
  row.className = `see-row chain-card horizontal-chain see-chain answer-${index}`;
  row.innerHTML = `
    <div class="answer-head">
      <span class="card-number">${index}</span>
    </div>
    <label class="routine-field">
      <span class="routine-label see-label">본 것</span>
      <span class="chain-block see-block simple-see-block">
        <textarea class="see-item" rows="1" maxlength="80" placeholder="보이는 걸 적어주세요." autocomplete="off">${escapeHtml(value)}</textarea>
      </span>
    </label>
  `;

  elements.seeList.append(row);
  resizeTextareas(row);
}

function renderThinkRows(seeItems) {
  elements.thinkList.innerHTML = "";

  seeItems.forEach((seeItem, index) => {
    const row = document.createElement("div");
    row.className = `chain-card horizontal-chain think-chain answer-${index + 1}`;
    row.innerHTML = `
      <div class="answer-head">
        <span class="card-number">${index + 1}</span>
      </div>
      <div class="routine-field">
        <span class="routine-label see-label">본 것</span>
        <div class="chain-block see-block">
          <p>${escapeHtml(seeItem)}</p>
        </div>
      </div>
      <label class="routine-field">
        <span class="routine-label think-label">생각한 것</span>
        <span class="chain-block think-block">
          <textarea class="think-item" rows="1" maxlength="120" placeholder="식물이 사는 곳에 어떤 도움이 될지 생각해 보세요." autocomplete="off" data-index="${index}"></textarea>
        </span>
      </label>
    `;
    elements.thinkList.append(row);
    resizeTextareas(row);
  });
}

function renderWonderRows(seeItems, thoughts) {
  elements.wonderList.innerHTML = "";

  seeItems.forEach((seeItem, index) => {
    const row = document.createElement("div");
    row.className = `chain-card horizontal-chain wonder-chain answer-${index + 1}`;
    row.innerHTML = `
      <div class="answer-head">
        <span class="card-number">${index + 1}</span>
      </div>
      <div class="routine-field">
        <span class="routine-label see-label">본 것</span>
        <div class="chain-block see-block">
          <p>${escapeHtml(seeItem)}</p>
        </div>
      </div>
      <div class="routine-field">
        <span class="routine-label think-label">생각한 것</span>
        <div class="chain-block think-block">
          <p>${escapeHtml(thoughts[index])}</p>
        </div>
      </div>
      <label class="routine-field">
        <span class="routine-label wonder-label">궁금한 것</span>
        <span class="chain-block wonder-block">
          <textarea class="wonder-item" rows="1" maxlength="120" placeholder="질문을 적어주세요." autocomplete="off" data-index="${index}"></textarea>
        </span>
      </label>
    `;
    elements.wonderList.append(row);
    resizeTextareas(row);
  });
}

function renderReviewRows(seeItems, thoughts, wonderItems) {
  elements.reviewList.innerHTML = "";

  seeItems.forEach((seeItem, index) => {
    const row = document.createElement("div");
    row.className = `chain-card horizontal-chain review-chain answer-${index + 1}`;
    row.innerHTML = `
      <div class="answer-head">
        <span class="card-number">${index + 1}</span>
      </div>
      <div class="routine-field">
        <div class="chain-block see-block">
          <p>${escapeHtml(seeItem)}</p>
        </div>
        <span class="routine-suffix">를 보고</span>
      </div>
      <div class="routine-field">
        <div class="chain-block think-block">
          <p>${escapeHtml(thoughts[index])}</p>
        </div>
        <span class="routine-suffix">라고 생각합니다.</span>
      </div>
      <div class="routine-field has-prefix">
        <span class="routine-prefix">그래서</span>
        <div class="chain-block wonder-block">
          <p>${escapeHtml(wonderItems[index])}</p>
        </div>
        <span class="routine-suffix">가 궁금합니다.</span>
      </div>
    `;
    elements.reviewList.append(row);
    resizeTextareas(row);
  });
}

function openConfirmModal(seeItems, thoughts, wonderItems) {
  modalMode = "student";
  document.querySelector("#confirmModalTitle").textContent = "확인";
  elements.modalBackButton.hidden = false;
  elements.modalSubmitButton.textContent = "제출";
  elements.modalSentenceList.innerHTML = seeItems
    .map((seeItem, index) => {
      return renderSentenceCard(seeItem, thoughts[index], wonderItems[index], index);
    })
    .join("");

  elements.confirmModal.hidden = false;
  elements.modalSubmitButton.focus();
}

function closeConfirmModal() {
  modalMode = "student";
  elements.confirmModal.hidden = true;
  elements.modalSentenceList.innerHTML = "";
  elements.modalBackButton.hidden = false;
  elements.modalSubmitButton.textContent = "제출";
}

function resizeTextarea(textarea) {
  textarea.style.height = "";
}

function resizeTextareas(container = document) {
  container.querySelectorAll("textarea").forEach((textarea) => {
    resizeTextarea(textarea);
  });
}

function getSeeItems() {
  return Array.from(elements.seeList.querySelectorAll(".see-item"))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function getThoughtItems() {
  return Array.from(elements.thinkList.querySelectorAll(".think-item")).map((input) => input.value.trim());
}

function getWonderItems() {
  return Array.from(elements.wonderList.querySelectorAll(".wonder-item")).map((input) => input.value.trim());
}

function buildThinkSentences(seeItems, thoughts) {
  return seeItems.map((seeItem, index) => `${seeItem}를 보고 ${thoughts[index]}라고 생각합니다.`);
}

function buildWonderSentences(thinkSentences, wonderItems) {
  return thinkSentences.map((sentence, index) => `${sentence} 그래서 ${wonderItems[index]}가 궁금합니다.`);
}

function resetStudentForm() {
  elements.studentForm.reset();
  selectedGroup = "";
  elements.groupButtons.forEach((button) => button.classList.remove("is-selected"));
  elements.seeList.innerHTML = "";
  elements.thinkList.innerHTML = "";
  elements.wonderList.innerHTML = "";
  elements.reviewList.innerHTML = "";
  for (let i = 0; i < seeItemCount; i += 1) {
    addSeeRow();
  }
  showStudentStep("group");
}

function focusFirstSeeInput() {
  elements.seeList.querySelector(".see-item")?.focus();
}

function focusFirstThinkInput() {
  elements.thinkList.querySelector(".think-item")?.focus();
}

function focusFirstWonderInput() {
  elements.wonderList.querySelector(".wonder-item")?.focus();
}

async function initResponses() {
  await checkBackendStatus();
  if (isBackendOnline) {
    await refreshResponses();
  } else {
    renderResponses();
  }
}

async function refreshResponses() {
  try {
    responses = await loadResponses();
    updateBackendStatus("online", "DB 연결됨");
    renderResponses();
  } catch {
    updateBackendStatus("offline", isSupabaseReady() ? "DB 연결 안 됨" : "설정 필요");
    showToast("결과를 불러오지 못했습니다.");
  }
}

async function checkBackendStatus() {
  updateBackendStatus("checking", "연결 확인");

  if (!isSupabaseReady()) {
    updateBackendStatus("offline", "설정 필요");
    return;
  }

  try {
    await supabaseRequest(`/${supabaseTable}?select=id&limit=1`);
    updateBackendStatus("online", "DB 연결됨");
  } catch {
    updateBackendStatus("offline", "DB 연결 안 됨");
  }
}

function updateBackendStatus(status, text) {
  isBackendOnline = status === "online";
  if (!elements.backendStatus || !elements.backendStatusText) return;

  elements.backendStatus.classList.remove("is-checking", "is-online", "is-offline");
  elements.backendStatus.classList.add(`is-${status}`);
  elements.backendStatus.setAttribute("aria-label", text);
  elements.backendStatus.setAttribute("title", text);
  elements.backendStatusText.textContent = text;
}

function startTeacherPolling() {
  stopTeacherPolling();
  teacherPollId = window.setInterval(() => {
    refreshResponses();
  }, 2000);
}

function stopTeacherPolling() {
  if (!teacherPollId) return;
  window.clearInterval(teacherPollId);
  teacherPollId = null;
}

async function loadResponses() {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const rows = await supabaseRequest(`/${supabaseTable}?select=*&order=created_at.desc`);
  return rows.map(fromSupabaseRow);
}

async function addResponse(response) {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const rows = await supabaseRequest(`/${supabaseTable}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toSupabaseRow(response)),
  });
  if (!rows[0]) {
    throw new Error("Supabase insert did not return a row");
  }
  responses = [fromSupabaseRow(rows[0]), ...responses];
}

async function clearResponses() {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  await supabaseRequest(`/${supabaseTable}?id=not.is.null`, { method: "DELETE" });
  responses = [];
}

async function deleteResponse(responseId) {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  await supabaseRequest(`/${supabaseTable}?id=eq.${encodeURIComponent(responseId)}`, { method: "DELETE" });
  responses = responses.filter((item) => item.id !== responseId);
}

function isSupabaseReady() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${supabaseRestUrl}${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Supabase request failed");
  }

  if (response.status === 204) return [];
  return await response.json();
}

function buildSupabaseRestUrl(url) {
  if (!url) return "";

  const trimmedUrl = url.replace(/\/+$/, "");
  if (trimmedUrl.endsWith("/rest/v1")) {
    return trimmedUrl;
  }

  return `${trimmedUrl}/rest/v1`;
}

function toSupabaseRow(response) {
  return {
    id: response.id,
    name: response.name,
    see: response.see,
    think: response.think,
    wonder: response.wonder,
    created_at: response.createdAt,
  };
}

function fromSupabaseRow(row) {
  return {
    id: row.id,
    name: row.name,
    see: row.see || [],
    think: row.think || [],
    wonder: row.wonder || [],
    createdAt: row.created_at,
  };
}

function renderResponses() {
  elements.emptyState.hidden = responses.length > 0;
  elements.responseList.innerHTML = "";

  const groupGrid = document.createElement("div");
  groupGrid.className = "teacher-group-grid";
  groupGrid.innerHTML = Array.from({ length: 6 }, (_, index) => {
    const groupName = `${index + 1}모둠`;
    const groupResponses = getResponsesByGroup(groupName);
    const disabled = groupResponses.length === 0 ? "disabled" : "";
    const countText = groupResponses.length === 0 ? "없음" : `${groupResponses.length}개`;

    return `
      <button class="teacher-group-button" type="button" data-teacher-group="${index + 1}" ${disabled}>
        <span>${groupName}</span>
        <small>${countText}</small>
      </button>
    `;
  }).join("");

  groupGrid.querySelectorAll("[data-teacher-group]").forEach((button) => {
    button.addEventListener("click", () => {
      openTeacherGroupModal(`${button.dataset.teacherGroup}모둠`);
    });
  });

  elements.responseList.append(groupGrid);
}

function getResponsesByGroup(groupName) {
  return responses.filter((item) => item.name === groupName);
}

function openTeacherGroupModal(groupName) {
  const groupResponses = getResponsesByGroup(groupName);

  modalMode = "teacher";
  document.querySelector("#confirmModalTitle").textContent = groupName;
  elements.modalBackButton.hidden = true;
  elements.modalSubmitButton.textContent = "닫기";
  elements.modalSentenceList.innerHTML = groupResponses
    .map((item, index) => {
      return `
        <section class="teacher-response-set">
          <button class="icon-delete-button" type="button" data-delete-response="${escapeAttribute(item.id)}" aria-label="답변 비우기" title="비우기">
            🗑️
          </button>
          ${renderResponseChains(item)}
        </section>
      `;
    })
    .join("");

  elements.modalSentenceList.querySelectorAll("[data-delete-response]").forEach((button) => {
    button.addEventListener("click", async () => {
      const responseId = button.dataset.deleteResponse;
      if (!responseId || !window.confirm("이 답변을 비울까요?")) return;

      try {
        await deleteResponse(responseId);
        renderResponses();
        const remainingResponses = getResponsesByGroup(groupName);
        if (remainingResponses.length === 0) {
          closeConfirmModal();
          showToast("비웠습니다.");
          return;
        }
        openTeacherGroupModal(groupName);
        showToast("비웠습니다.");
      } catch {
        showToast("답변을 비우지 못했습니다.");
      }
    });
  });

  elements.confirmModal.hidden = false;
  elements.modalSubmitButton.focus();
}

function renderResponseChains(item) {
  const seeItems = normalizeList(item.see);
  const thinkItems = normalizeList(item.think);
  const wonderItems = normalizeList(item.wonder);

  return `
    <div class="teacher-sentence-list" aria-label="모둠 결과">
      ${seeItems
        .map((seeItem, index) => {
          return `
            ${renderSentenceCard(seeItem, thinkItems[index] || "", wonderItems[index] || "", index)}
          `;
        })
        .join("")}
    </div>
  `;
}

function renderSentenceCard(seeItem, thought, wonderItem, index) {
  return `
    <article class="sentence-card answer-${index + 1}">
      <span class="card-number">${index + 1}</span>
      <div class="sentence-lines">
        <p><span class="sentence-block see-block">${escapeHtml(seeItem)}</span> 를 보고</p>
        <p><span class="sentence-block think-block">${escapeHtml(thought)}</span> 라고 생각합니다.</p>
        <p><strong>그래서</strong> <span class="sentence-block wonder-block">${escapeHtml(wonderItem)}</span> 가 궁금합니다.</p>
      </div>
    </article>
  `;
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [value];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `stw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const tempInput = document.createElement("textarea");
  tempInput.value = text;
  tempInput.setAttribute("readonly", "");
  tempInput.style.position = "fixed";
  tempInput.style.left = "-9999px";
  document.body.append(tempInput);
  tempInput.select();

  const copied = document.execCommand("copy");
  tempInput.remove();

  if (!copied) {
    throw new Error("Copy command failed");
  }
}

function showToast(message) {
  const previousToast = document.querySelector(".toast");
  if (previousToast) previousToast.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2200);
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseTable = "stw_responses";
const supabaseSettingsTable = "stw_settings";
const activeStepSettingId = "active_step";
const supabaseRestUrl = buildSupabaseRestUrl(supabaseUrl);
const studentCount = 23;
const answerAccentCount = 3;
const teacherSteps = {
  see: { label: "보기", empty: "미제출" },
  think: { label: "생각하기", empty: "미제출" },
  wonder: { label: "궁금해하기", empty: "미제출" },
};

const elements = {
  roleView: document.querySelector("#roleView"),
  backendStatus: document.querySelector("#backendStatus"),
  backendStatusText: document.querySelector("#backendStatusText"),
  teacherView: document.querySelector("#teacherView"),
  teacherTitle: document.querySelector("#teacherView h1"),
  teacherTopTabs: document.querySelector("#teacherTopTabs"),
  studentView: document.querySelector("#studentView"),
  teacherRoleButton: document.querySelector("#teacherRoleButton"),
  studentRoleButton: document.querySelector("#studentRoleButton"),
  changeRoleButtons: document.querySelectorAll("[data-change-role]"),
  studentStepTitle: document.querySelector("#studentStepTitle"),
  studentForm: document.querySelector("#studentForm"),
  topPrevButton: document.querySelector("#topPrevButton"),
  topNextButton: document.querySelector("#topNextButton"),
  groupButtons: document.querySelector("#groupButtons"),
  studentNumberInput: document.querySelector("#studentNumberInput"),
  seeList: document.querySelector("#seeList"),
  thinkList: document.querySelector("#thinkList"),
  wonderList: document.querySelector("#wonderList"),
  responseList: document.querySelector("#responseList"),
  emptyState: document.querySelector("#emptyState"),
  confirmModal: document.querySelector("#confirmModal"),
  modalSentenceList: document.querySelector("#modalSentenceList"),
  modalBackButton: document.querySelector("#modalBackButton"),
  modalSubmitButton: document.querySelector("#modalSubmitButton"),
};

let responses = [];
let selectedStudentNumber = "";
let currentStudentStep = "student";
let activeTeacherStep = "see";
let activeClassStep = "see";
let modalMode = "student";
let teacherPollId = null;
let studentStepPollId = null;
let isBackendOnline = false;
let teacherToolsClickCount = 0;
let teacherToolsUnlocked = false;

initStudentButtons();
initResponses();

elements.teacherRoleButton.addEventListener("click", () => showTeacherView());
elements.studentRoleButton.addEventListener("click", () => showStudentView());

elements.teacherTitle.addEventListener("click", () => {
  if (teacherToolsUnlocked) return;

  teacherToolsClickCount += 1;
  if (teacherToolsClickCount >= 5) {
    teacherToolsUnlocked = true;
    showToast("관리 버튼을 표시합니다.");
    renderResponses();
  }
});

elements.changeRoleButtons.forEach((button) => {
  button.addEventListener("click", () => showRoleView());
});

elements.studentForm.addEventListener("input", (event) => {
  if (event.target instanceof HTMLTextAreaElement) {
    resizeTextarea(event.target);
  }
  updateStudentSubmitState();
});

elements.studentForm.addEventListener("keydown", (event) => {
  if (event.target === elements.studentNumberInput && event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    goToNextStudentStep();
    return;
  }

  if (!(event.target instanceof HTMLTextAreaElement) || event.key !== "Enter" || event.isComposing) {
    return;
  }

  event.preventDefault();
  completeTextareaEntry(event.target);
});

elements.topPrevButton?.addEventListener("click", () => {
  goToPreviousStudentStep();
});

elements.topNextButton.addEventListener("click", () => {
  goToNextStudentStep();
});

elements.studentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitCurrentStudentStep();
});

elements.modalBackButton.addEventListener("click", () => {
  closeConfirmModal();
});

elements.modalSubmitButton.addEventListener("click", () => {
  closeConfirmModal();
});

elements.confirmModal.addEventListener("click", (event) => {
  if (event.target === elements.confirmModal) {
    closeConfirmModal();
  }
});

function initStudentButtons() {
  elements.studentNumberInput.addEventListener("input", () => {
    const normalizedNumber = normalizeStudentNumber(elements.studentNumberInput.value);
    selectedStudentNumber = normalizedNumber ? String(normalizedNumber) : "";
    if (selectedStudentNumber) {
      loadSelectedStudentResponse();
    } else {
      renderEmptyStepInputs();
    }
  });
}

function loadSelectedStudentResponse() {
  renderEmptyStepInputs();
}

async function submitCurrentStudentStep() {
  if (currentStudentStep === "see") {
    await submitSeeStep();
    return;
  }
  if (currentStudentStep === "think") {
    await submitThinkStep();
    return;
  }
  if (currentStudentStep === "wonder") {
    await submitWonderStep();
  }
}

async function submitSeeStep() {
  const seeItem = getStepInputValue("see");
  if (!getStudentName()) {
    showToast("학생 번호를 골라 주세요.");
    return;
  }
  if (!seeItem) {
    showToast("보이는 것을 써 주세요.");
    return;
  }

  try {
    await appendStudentStep("see", seeItem);
  } catch {
    showToast("보기 결과를 제출하지 못했습니다.");
    return;
  }

  clearStepInput("see");
  renderResponses();
  showToast(`${getStudentName()} 보기 제출 완료`);
  focusFirstSeeInput();
}

async function submitThinkStep() {
  const thought = getStepInputValue("think");
  if (!thought) {
    showToast("생각한 것을 써 주세요.");
    return;
  }

  try {
    await appendStudentStep("think", thought);
  } catch {
    showToast("생각하기 결과를 제출하지 못했습니다.");
    return;
  }

  clearStepInput("think");
  renderResponses();
  showToast(`${getStudentName()} 생각하기 제출 완료`);
  focusFirstThinkInput();
}

async function submitWonderStep() {
  const wonderItem = getStepInputValue("wonder");
  if (!wonderItem) {
    showToast("궁금한 것을 써 주세요.");
    return;
  }

  try {
    await appendStudentStep("wonder", wonderItem);
  } catch {
    showToast("궁금해하기 결과를 제출하지 못했습니다.");
    return;
  }

  clearStepInput("wonder");
  renderResponses();
  showToast(`${getStudentName()} 궁금해하기 제출 완료`);
  focusFirstWonderInput();
}

function showRoleView() {
  stopTeacherPolling();
  stopStudentStepPolling();
  closeConfirmModal();
  elements.roleView.hidden = false;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = true;
}

async function showTeacherView() {
  stopStudentStepPolling();
  await refreshActiveClassStep({ renderStudent: false });
  activeTeacherStep = activeClassStep;
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
  elements.studentNumberInput?.focus();
  refreshActiveClassStep();
  startStudentStepPolling();
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
    student: { icon: "", text: "학생 번호" },
    see: { icon: "👀", text: "무엇을 볼 수 있나요?" },
    think: { icon: "🤔", text: "식물이 사는 곳에 어떤 도움이 될까요?" },
    wonder: { icon: "❓", text: "더 알고 싶은 점은 무엇인가요?" },
  };
  const title = titles[step] || titles.student;
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
    student: { prev: true, next: "다음" },
    see: { prev: false, next: "제출" },
    think: { prev: false, next: "제출" },
    wonder: { prev: false, next: "제출" },
  };
  const action = topActionByStep[step] || topActionByStep.student;

  if (elements.topPrevButton) {
    elements.topPrevButton.hidden = !action.prev;
  }
  elements.topNextButton.textContent = action.next;
  updateStudentSubmitState();
}

function updateStudentSubmitState() {
  if (currentStudentStep === "student") {
    elements.topNextButton.disabled = false;
    return;
  }

  elements.topNextButton.disabled = getStepInputValue(currentStudentStep).length === 0;
}

function goToPreviousStudentStep() {
  if (currentStudentStep === "student") {
    showRoleView();
    return;
  }

  showStudentStep("student");
  elements.studentNumberInput?.focus();
}

function goToNextStudentStep() {
  if (currentStudentStep === "student") {
    goFromStudentToSee();
    return;
  }

  submitCurrentStudentStep();
}

function goFromStudentToSee() {
  const studentNumber = normalizeStudentNumber(elements.studentNumberInput.value);
  if (!studentNumber) {
    showToast("1번부터 23번까지 입력해 주세요.");
    return;
  }

  selectedStudentNumber = String(studentNumber);
  loadSelectedStudentResponse();
  showStudentStep(activeClassStep);
  focusCurrentStepInput();
}

function renderEmptyStepInputs() {
  resetAnswerLists();
  addSeeRow();
  renderThinkRows();
  renderWonderRows();
}

function addSeeRow(value = "") {
  const row = document.createElement("div");
  row.className = "single-response-card see-response-card";
  row.innerHTML = `
    <label class="single-response-field">
      <textarea class="see-item single-response-input" rows="1" maxlength="80" placeholder="보이는 걸 적어주세요." autocomplete="off">${escapeHtml(value)}</textarea>
    </label>
  `;

  elements.seeList.append(row);
  resizeTextareas(row);
}

function renderThinkRows(value = "") {
  elements.thinkList.innerHTML = "";
  const row = document.createElement("div");
  row.className = "single-response-card think-response-card";
  row.innerHTML = `
    <label class="single-response-field">
      <textarea class="think-item single-response-input" rows="1" maxlength="120" placeholder="생각한 것을 적어주세요." autocomplete="off">${escapeHtml(value)}</textarea>
    </label>
  `;
  elements.thinkList.append(row);
  resizeTextareas(row);
}

function renderWonderRows(value = "") {
  elements.wonderList.innerHTML = "";
  const row = document.createElement("div");
  row.className = "single-response-card wonder-response-card";
  row.innerHTML = `
    <label class="single-response-field">
      <textarea class="wonder-item single-response-input" rows="1" maxlength="120" placeholder="궁금한 것을 적어주세요." autocomplete="off">${escapeHtml(value)}</textarea>
    </label>
  `;
  elements.wonderList.append(row);
  resizeTextareas(row);
}

function closeConfirmModal() {
  modalMode = "student";
  elements.confirmModal.hidden = true;
  elements.confirmModal.classList.remove("teacher-tools-locked");
  elements.modalSentenceList.innerHTML = "";
  elements.modalBackButton.hidden = false;
  elements.modalSubmitButton.textContent = "닫기";
}

function resizeTextarea(textarea) {
  textarea.style.height = "";
}

function resizeTextareas(container = document) {
  container.querySelectorAll("textarea").forEach((textarea) => {
    resizeTextarea(textarea);
  });
}

function completeTextareaEntry(textarea) {
  textarea.blur();
  submitCurrentStudentStep();
}

function getStepInputValue(step) {
  const inputByStep = {
    see: elements.seeList.querySelector(".see-item"),
    think: elements.thinkList.querySelector(".think-item"),
    wonder: elements.wonderList.querySelector(".wonder-item"),
  };
  return inputByStep[step]?.value.trim() || "";
}

function clearStepInput(step) {
  const inputByStep = {
    see: elements.seeList.querySelector(".see-item"),
    think: elements.thinkList.querySelector(".think-item"),
    wonder: elements.wonderList.querySelector(".wonder-item"),
  };
  const input = inputByStep[step];
  if (!input) return;
  input.value = "";
  resizeTextarea(input);
  updateStudentSubmitState();
}

function resetStudentForm() {
  elements.studentForm.reset();
  selectedStudentNumber = "";
  renderEmptyStepInputs();
  showStudentStep("student");
}

function resetAnswerLists() {
  elements.seeList.innerHTML = "";
  elements.thinkList.innerHTML = "";
  elements.wonderList.innerHTML = "";
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

function focusCurrentStepInput() {
  const focusByStep = {
    see: focusFirstSeeInput,
    think: focusFirstThinkInput,
    wonder: focusFirstWonderInput,
  };
  focusByStep[currentStudentStep]?.();
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

function startStudentStepPolling() {
  stopStudentStepPolling();
  studentStepPollId = window.setInterval(() => {
    if (!elements.studentView.hidden) {
      refreshActiveClassStep();
    }
  }, 2000);
}

function stopStudentStepPolling() {
  if (!studentStepPollId) return;
  window.clearInterval(studentStepPollId);
  studentStepPollId = null;
}

async function loadResponses() {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const rows = await supabaseRequest(`/${supabaseTable}?select=*&order=created_at.desc`);
  return rows.map(fromSupabaseRow);
}

async function refreshActiveClassStep(options = {}) {
  const { renderStudent = true } = options;
  const previousStep = activeClassStep;

  try {
    activeClassStep = await loadActiveClassStep();
  } catch {
    activeClassStep = previousStep || "see";
  }

  if (!isTeacherStep(activeClassStep)) {
    activeClassStep = "see";
  }

  if (renderStudent && !elements.studentView.hidden && currentStudentStep !== "student" && currentStudentStep !== activeClassStep) {
    showStudentStep(activeClassStep);
    focusCurrentStepInput();
  }

  return activeClassStep;
}

async function loadActiveClassStep() {
  if (!isSupabaseReady()) {
    return activeClassStep || "see";
  }

  const rows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(activeStepSettingId)}&select=value&limit=1`
  );
  const step = rows[0]?.value;
  return isTeacherStep(step) ? step : "see";
}

async function saveActiveClassStep(step) {
  if (!isTeacherStep(step)) return;
  activeClassStep = step;

  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const payload = {
    id: activeStepSettingId,
    value: step,
    updated_at: new Date().toISOString(),
  };

  const existingRows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(activeStepSettingId)}&select=id&limit=1`
  );

  if (existingRows[0]) {
    await supabaseRequest(`/${supabaseSettingsTable}?id=eq.${encodeURIComponent(activeStepSettingId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
    return;
  }

  await supabaseRequest(`/${supabaseSettingsTable}`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });
}

async function appendStudentStep(step, value) {
  const studentName = getStudentName();
  const existingResponse = getResponseByStudentName(studentName);
  const existingValues = normalizeList(existingResponse?.[step]).filter(Boolean);
  return await saveStudentStep(step, [...existingValues, value]);
}

async function saveStudentStep(step, values) {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const studentName = getStudentName();
  const existingResponse = getResponseByStudentName(studentName);
  const payload = { [step]: values };

  if (existingResponse) {
    try {
      const rows = await supabaseRequest(`/${supabaseTable}?id=eq.${encodeURIComponent(existingResponse.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      if (!rows[0]) {
        throw new Error("Supabase update did not return a row");
      }
      const updatedResponse = fromSupabaseRow(rows[0]);
      responses = responses.map((item) => (item.id === updatedResponse.id ? updatedResponse : item));
      return updatedResponse;
    } catch {
      return await replaceResponseByInsert(existingResponse, payload);
    }
  }

  const response = {
    id: createId(),
    name: studentName,
    see: step === "see" ? values : [],
    think: step === "think" ? values : [],
    wonder: step === "wonder" ? values : [],
    createdAt: new Date().toISOString(),
  };
  const rows = await supabaseRequest(`/${supabaseTable}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toSupabaseRow(response)),
  });
  if (!rows[0]) {
    throw new Error("Supabase insert did not return a row");
  }
  const createdResponse = fromSupabaseRow(rows[0]);
  responses = [createdResponse, ...responses];
  return createdResponse;
}

async function replaceResponseByInsert(existingResponse, payload) {
  const replacement = {
    ...existingResponse,
    ...payload,
    id: createId(),
  };

  const rows = await supabaseRequest(`/${supabaseTable}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toSupabaseRow(replacement)),
  });
  if (!rows[0]) {
    throw new Error("Supabase insert did not return a replacement row");
  }

  await supabaseRequest(`/${supabaseTable}?id=eq.${encodeURIComponent(existingResponse.id)}`, { method: "DELETE" });
  const updatedResponse = fromSupabaseRow(rows[0]);
  responses = [updatedResponse, ...responses.filter((item) => item.id !== existingResponse.id)];
  return updatedResponse;
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

async function deleteStepAnswer(responseId, step, answerIndex) {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const originalResponse = responses.find((item) => item.id === responseId);
  if (!originalResponse || !["see", "think", "wonder"].includes(step)) {
    throw new Error("Answer not found");
  }

  const nextValues = normalizeList(originalResponse[step]).filter((_, index) => index !== answerIndex);
  try {
    const rows = await supabaseRequest(`/${supabaseTable}?id=eq.${encodeURIComponent(responseId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ [step]: nextValues }),
    });
    if (!rows[0]) {
      throw new Error("Supabase update did not return a row");
    }

    const updatedResponse = fromSupabaseRow(rows[0]);
    responses = responses.map((item) => (item.id === responseId ? updatedResponse : item));
  } catch {
    await replaceResponseByInsert(originalResponse, { [step]: nextValues });
  }
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
    see: normalizeList(row.see),
    think: normalizeList(row.think),
    wonder: normalizeList(row.wonder),
    createdAt: row.created_at,
  };
}

function renderResponses() {
  elements.emptyState.hidden = true;
  elements.teacherTopTabs.innerHTML = "";
  elements.teacherTopTabs.append(renderTeacherTabs());
  elements.responseList.innerHTML = "";
  elements.responseList.append(renderTeacherDashboard());
}

function renderTeacherDashboard() {
  const dashboard = document.createElement("section");
  dashboard.className = `teacher-dashboard is-${activeTeacherStep}`;
  dashboard.append(renderTeacherDashboardBody());
  return dashboard;
}

function renderTeacherDashboardBody() {
  const body = document.createElement("div");
  body.className = "teacher-dashboard-body";
  body.append(renderSubmissionStatusPanel(), renderCollectedAnswersPanel());
  return body;
}

function renderSubmissionStatusPanel() {
  const panel = document.createElement("section");
  panel.className = "teacher-dashboard-panel teacher-status-panel";
  panel.append(renderTeacherStudentGrid());
  return panel;
}

function renderCollectedAnswersPanel() {
  const panel = document.createElement("section");
  panel.className = "teacher-dashboard-panel teacher-collected-panel";
  panel.innerHTML = `
    ${renderCollectedAnswers(activeTeacherStep)}
  `;
  panel.querySelectorAll("[data-delete-answer]").forEach((button) => {
    button.addEventListener("click", async () => {
      const responseId = button.dataset.responseId;
      const step = button.dataset.answerStep;
      const answerIndex = Number(button.dataset.answerIndex);
      if (!responseId || !step || !Number.isInteger(answerIndex)) return;

      const card = button.closest(".postit-card");
      button.disabled = true;
      card?.classList.add("is-removing");
      await waitForCardExit(card);

      try {
        await deleteStepAnswer(responseId, step, answerIndex);
        renderResponses();
        showToast("답변을 지웠습니다.");
      } catch {
        button.disabled = false;
        card?.classList.remove("is-removing");
        showToast("답변을 지우지 못했습니다.");
      }
    });
  });
  return panel;
}

function waitForCardExit(card) {
  if (!card) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, 220);
  });
}

function renderTeacherTabs() {
  const tabs = document.createElement("div");
  tabs.className = `teacher-step-tabs is-${activeTeacherStep}`;
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "결과 단계 선택");
  tabs.innerHTML = Object.entries(teacherSteps)
    .map(([step, config]) => {
      const selected = step === activeTeacherStep;
      const count = getStudentResponses().filter((item) => hasSubmittedStep(item, step)).length;
      return `
        <button class="teacher-step-tab ${selected ? "is-selected" : ""}" type="button" role="tab" aria-selected="${selected}" data-teacher-step="${step}">
          <span>${config.label}</span>
          <small>${count}/${studentCount}</small>
        </button>
      `;
    })
    .join("");

  tabs.querySelectorAll("[data-teacher-step]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextStep = button.dataset.teacherStep;
      if (!isTeacherStep(nextStep)) return;

      activeTeacherStep = nextStep;
      activeClassStep = nextStep;
      renderResponses();

      try {
        await saveActiveClassStep(nextStep);
      } catch {
        showToast("단계를 바꾸지 못했습니다.");
      }
    });
  });

  return tabs;
}

function renderTeacherStudentGrid() {
  const grid = document.createElement("div");
  grid.className = "teacher-student-grid";
  grid.innerHTML = Array.from({ length: studentCount }, (_, index) => {
    const studentName = `${index + 1}번`;
    const response = getResponseByStudentName(studentName);
    const values = normalizeList(response?.[activeTeacherStep]).filter(Boolean);
    const submitted = values.length > 0;
    return `
      <button class="teacher-student-button ${submitted ? "is-submitted" : "is-empty"}" type="button" data-teacher-student="${index + 1}" ${submitted ? "" : "disabled"}>
        <span>${index + 1}</span>
      </button>
    `;
  }).join("");

  grid.querySelectorAll("[data-teacher-student]:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => {
      openTeacherStudentModal(`${button.dataset.teacherStudent}번`, activeTeacherStep);
    });
  });

  return grid;
}

function renderCollectedAnswers(step) {
  const cards = getCollectedStepAnswers(step);
  if (cards.length === 0) {
    return `<div class="teacher-step-empty">${teacherSteps[step].empty}</div>`;
  }

  return `
    <div class="teacher-postit-grid" aria-label="${teacherSteps[step].label} 전체 답변">
      ${cards
        .map((card, index) => `
          <article class="postit-card answer-${(index % answerAccentCount) + 1}">
            <button
              class="postit-delete-button"
              type="button"
              data-delete-answer
              data-response-id="${escapeAttribute(card.responseId)}"
              data-answer-step="${escapeAttribute(card.step)}"
              data-answer-index="${card.answerIndex}"
              aria-label="답변 지우기"
              title="지우기"
            >
              X
            </button>
            <div class="postit-content">${card.compact}</div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function getCollectedStepAnswers(step) {
  return Array.from({ length: studentCount }, (_, index) => getResponseByStudentName(`${index + 1}번`))
    .filter(Boolean)
    .flatMap((response) => buildCollectedStepCards(response, step));
}

function buildCollectedStepCards(response, step) {
  const seeItems = normalizeList(response.see);
  const thinkItems = normalizeList(response.think);
  const wonderItems = normalizeList(response.wonder);
  const buildCard = (value, answerIndex, blockClass) => ({
    responseId: response.id,
    step,
    answerIndex,
    compact: `<p>${escapeHtml(value)}</p>`,
    large: `<p><span class="sentence-block ${blockClass}">${escapeHtml(value)}</span></p>`,
  });

  if (step === "see") {
    return seeItems.map((value, index) => ({ value, index })).filter((item) => item.value).map((item) => buildCard(item.value, item.index, "see-block"));
  }

  if (step === "think") {
    return thinkItems.map((value, index) => ({ value, index })).filter((item) => item.value).map((item) => buildCard(item.value, item.index, "think-block"));
  }

  return wonderItems.map((value, index) => ({ value, index })).filter((item) => item.value).map((item) => buildCard(item.value, item.index, "wonder-block"));
}

function openTeacherStudentModal(studentName, step) {
  const response = getResponseByStudentName(studentName);
  if (!response) return;

  modalMode = "teacher";
  document.querySelector("#confirmModalTitle").textContent = `${studentName} ${teacherSteps[step].label}`;
  elements.modalBackButton.hidden = true;
  elements.modalSubmitButton.textContent = "닫기";
  elements.confirmModal.classList.toggle("teacher-tools-locked", !teacherToolsUnlocked);
  elements.modalSentenceList.innerHTML = `
    <section class="teacher-response-set">
      <button class="icon-delete-button" type="button" data-delete-response="${escapeAttribute(response.id)}" aria-label="학생 답변 비우기" title="비우기">
        삭제
      </button>
      ${renderStepResponse(response, step)}
    </section>
  `;

  elements.modalSentenceList.querySelector("[data-delete-response]")?.addEventListener("click", async (event) => {
    const responseId = event.currentTarget.dataset.deleteResponse;
    if (!responseId || !window.confirm(`${studentName}의 답변을 모두 비울까요?`)) return;

    try {
      await deleteResponse(responseId);
      renderResponses();
      closeConfirmModal();
      showToast("비웠습니다.");
    } catch {
      showToast("답변을 비우지 못했습니다.");
    }
  });

  elements.confirmModal.hidden = false;
  elements.modalSubmitButton.focus();
}

function renderStepResponse(item, step) {
  const seeItems = normalizeList(item.see);
  const thinkItems = normalizeList(item.think);
  const wonderItems = normalizeList(item.wonder);

  if (step === "see") {
    return renderValueCards(seeItems, "see", (value) => `<p><span class="sentence-block see-block">${escapeHtml(value)}</span></p>`);
  }

  if (step === "think") {
    return renderValueCards(thinkItems, "think", (value) => `<p><span class="sentence-block think-block">${escapeHtml(value)}</span></p>`);
  }

  return renderValueCards(wonderItems, "wonder", (value) => `<p><span class="sentence-block wonder-block">${escapeHtml(value)}</span></p>`);
}

function renderValueCards(values, step, contentBuilder) {
  const submittedValues = normalizeList(values).filter(Boolean);
  if (submittedValues.length === 0) {
    return `<div class="teacher-step-empty">${teacherSteps[step].empty}</div>`;
  }

  return `
    <div class="teacher-sentence-list" aria-label="${teacherSteps[step].label} 결과">
      ${submittedValues
        .map((value, index) => `
          <article class="sentence-card answer-${index + 1}">
            <span class="card-number">${index + 1}</span>
            <div class="sentence-lines">${contentBuilder(value, index)}</div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function hasSubmittedStep(response, step) {
  return normalizeList(response?.[step]).filter(Boolean).length > 0;
}

function isTeacherStep(step) {
  return Object.prototype.hasOwnProperty.call(teacherSteps, step);
}

function getSelectedStudentResponse() {
  return getResponseByStudentName(getStudentName());
}

function getResponseByStudentName(studentName) {
  if (!studentName) return null;
  return responses.find((item) => item.name === studentName) || null;
}

function getStudentResponses() {
  return responses.filter((item) => isStudentName(item.name));
}

function isStudentName(name) {
  const match = /^(\d+)번$/.exec(name || "");
  if (!match) return false;
  const number = Number(match[1]);
  return number >= 1 && number <= studentCount;
}

function getStudentName() {
  return selectedStudentNumber ? `${selectedStudentNumber}번` : "";
}

function normalizeStudentNumber(value) {
  const number = Number.parseInt(String(value).trim(), 10);
  if (!Number.isInteger(number) || number < 1 || number > studentCount) {
    return null;
  }
  return number;
}

function normalizeList(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
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

function showToast(message) {
  let toastStack = document.querySelector(".toast-stack");
  if (!toastStack) {
    toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    document.body.append(toastStack);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  toastStack.append(toast);

  window.setTimeout(() => {
    toast.remove();
    if (toastStack.childElementCount === 0) {
      toastStack.remove();
    }
  }, 4000);
}

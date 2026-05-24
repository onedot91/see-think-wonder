const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseTable = "stw_responses";
const supabaseSettingsTable = "stw_settings";
const activeStepSettingId = "active_step";
const activeModeSettingId = "active_mode";
const classImageSettingId = "class_image";
const supabaseRestUrl = buildSupabaseRestUrl(supabaseUrl);
const studentCount = 23;
const answerAccentCount = 3;
const classImageAspectRatio = 4 / 3;
const classImageMaxWidth = 1200;
const classModes = {
  sequential: "순차 진행",
  combined: "한 번에 작성",
};
const teacherSteps = {
  see: { label: "보기", empty: "미제출" },
  think: { label: "생각하기", empty: "미제출" },
  wonder: { label: "궁금해하기", empty: "미제출" },
};

const elements = {
  roleView: document.querySelector("#roleView"),
  backendStatus: document.querySelector("#backendStatus"),
  backendStatusText: document.querySelector("#backendStatusText"),
  teacherModeView: document.querySelector("#teacherModeView"),
  teacherView: document.querySelector("#teacherView"),
  teacherTitle: document.querySelector("#teacherView h1"),
  teacherModeTabs: document.querySelector("#teacherModeTabs"),
  teacherTopTabs: document.querySelector("#teacherTopTabs"),
  studentView: document.querySelector("#studentView"),
  teacherRoleButton: document.querySelector("#teacherRoleButton"),
  teacherModeChoiceButtons: document.querySelectorAll("[data-open-teacher-mode]"),
  classImageInput: document.querySelector("#classImageInput"),
  classImagePreview: document.querySelector("#classImagePreview"),
  classImageStatus: document.querySelector("#classImageStatus"),
  studentRoleButton: document.querySelector("#studentRoleButton"),
  changeRoleButtons: document.querySelectorAll("[data-change-role]"),
  studentStepTitle: document.querySelector("#studentStepTitle"),
  studentForm: document.querySelector("#studentForm"),
  topPrevButton: document.querySelector("#topPrevButton"),
  topNextButton: document.querySelector("#topNextButton"),
  studentResultButton: document.querySelector("#studentResultButton"),
  studentClassImageCard: document.querySelector("#studentClassImageCard"),
  studentClassImage: document.querySelector("#studentClassImage"),
  classImageLightbox: document.querySelector("#classImageLightbox"),
  classImageLightboxImage: document.querySelector("#classImageLightboxImage"),
  classImageLightboxClose: document.querySelector("#classImageLightboxClose"),
  groupButtons: document.querySelector("#groupButtons"),
  studentNumberInput: document.querySelector("#studentNumberInput"),
  seeList: document.querySelector("#seeList"),
  thinkList: document.querySelector("#thinkList"),
  wonderList: document.querySelector("#wonderList"),
  combinedList: document.querySelector("#combinedList"),
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
let activeClassMode = null;
let classImageDataUrl = "";
let modalMode = "student";
let teacherPollId = null;
let studentStepPollId = null;
let isBackendOnline = false;
let teacherToolsClickCount = 0;
let teacherToolsUnlocked = false;

initStudentButtons();
initResponses();

elements.teacherRoleButton.addEventListener("click", () => showTeacherModeView());
elements.studentRoleButton.addEventListener("click", () => showStudentView());

elements.teacherModeChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showTeacherView(button.dataset.openTeacherMode);
  });
});

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

elements.classImageInput?.addEventListener("change", () => {
  uploadClassImage(elements.classImageInput.files?.[0]);
});

elements.studentClassImageCard?.addEventListener("click", () => {
  openClassImageLightbox();
});

elements.studentClassImageCard?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openClassImageLightbox();
});

elements.classImageLightboxClose?.addEventListener("click", () => {
  closeClassImageLightbox();
});

elements.classImageLightbox?.addEventListener("click", (event) => {
  if (event.target === elements.classImageLightbox) {
    closeClassImageLightbox();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.classImageLightbox && !elements.classImageLightbox.hidden) {
    closeClassImageLightbox();
  }
});

elements.studentResultButton?.addEventListener("click", () => {
  openStudentResults();
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
  if (currentStudentStep === "combined") {
    await submitCombinedStep();
    return;
  }
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

async function submitCombinedStep() {
  const combinedItem = getCombinedInputValues();
  if (!getStudentName()) {
    showToast("학생 번호를 입력해 주세요.");
    return;
  }
  if (!isCompleteCombinedItem(combinedItem)) {
    showToast("보기, 생각하기, 궁금해하기를 모두 적어 주세요.");
    return;
  }

  try {
    await appendCombinedStep(combinedItem);
  } catch {
    showToast("결과를 제출하지 못했습니다.");
    return;
  }

  clearCombinedInputs();
  renderResponses();
  showToast(`${getStudentName()} 제출 완료`);
  focusFirstCombinedInput();
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
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = true;
}

async function showTeacherModeView() {
  stopTeacherPolling();
  stopStudentStepPolling();
  closeConfirmModal();
  activeClassMode = null;
  if (isSupabaseReady()) {
    try {
      await saveClassModeSetting("waiting");
    } catch {
      showToast("대기 상태를 저장하지 못했습니다.");
    }
  }
  refreshClassImage();
  elements.roleView.hidden = true;
  elements.teacherModeView.hidden = false;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = true;
}

async function showTeacherView(selectedMode = null) {
  stopStudentStepPolling();
  if (isClassMode(selectedMode)) {
    activeClassMode = selectedMode;
    try {
      await saveActiveClassMode(selectedMode);
      if (selectedMode === "sequential") {
        await saveActiveClassStep("see");
      }
    } catch {
      showToast("모드를 저장하지 못했습니다.");
    }
  } else {
    await refreshActiveClassMode({ renderStudent: false });
  }
  await refreshActiveClassStep({ renderStudent: false });
  activeTeacherStep = activeClassStep;
  await refreshResponses();
  startTeacherPolling();
  elements.roleView.hidden = true;
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = false;
  elements.studentView.hidden = true;
}

function showStudentView() {
  stopTeacherPolling();
  resetStudentForm();
  activeClassMode = null;
  elements.roleView.hidden = true;
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = false;
  elements.studentNumberInput?.focus();
  refreshClassImage();
  refreshActiveClassMode();
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
    think: { icon: "🤔", text: "어떤 생각이 드나요?" },
    wonder: { icon: "❓", text: "더 알고 싶은 점은 무엇인가요?" },
    combined: { icon: "✍", text: "한 번에 작성하기" },
    waiting: { icon: "", text: "대기 중" },
  };
  const title = titles[step] || titles.student;
  elements.studentStepTitle.innerHTML = title.icon
    ? `<span class="step-title-icon" aria-hidden="true">${title.icon}</span><span class="step-title-text">${title.text}</span>`
    : `<span class="step-title-text">${title.text}</span>`;
  renderClassImage();
  animateClassImageEntrance(step);
  updateStudentTopActions(step);

  if (activeSection) {
    window.requestAnimationFrame(() => {
      activeSection.classList.add("is-entering");
    });
  }
}

function animateClassImageEntrance(step) {
  if (!elements.studentView || !classImageDataUrl || step === "student") return;

  elements.studentView.classList.remove("is-image-entering");
  void elements.studentView.offsetWidth;
  elements.studentView.classList.add("is-image-entering");
}

function updateStudentTopActions(step) {
  const topActionByStep = {
    student: { prev: true, next: "다음" },
    see: { prev: false, next: "제출" },
    think: { prev: false, next: "제출" },
    wonder: { prev: false, next: "제출" },
    combined: { prev: false, next: "제출" },
    waiting: { prev: false, next: "대기 중", hideNext: true },
  };
  const action = topActionByStep[step] || topActionByStep.student;

  if (elements.topPrevButton) {
    elements.topPrevButton.hidden = !action.prev;
  }
  elements.topNextButton.hidden = Boolean(action.hideNext);
  elements.topNextButton.textContent = action.next;
  updateStudentSubmitState();
}

function updateStudentSubmitState() {
  const isAnswerStep = isTeacherStep(currentStudentStep) || currentStudentStep === "combined";

  if (currentStudentStep === "student") {
    elements.topNextButton.hidden = false;
    elements.topNextButton.disabled = false;
    if (elements.studentResultButton) {
      elements.studentResultButton.hidden = true;
    }
    return;
  }

  elements.topNextButton.disabled = !isAnswerStep || !hasCurrentStudentInput();
  if (elements.studentResultButton) {
    elements.studentResultButton.hidden = !hasSubmittedCurrentStudentStep();
  }
}

function hasCurrentStudentInput() {
  if (currentStudentStep === "combined") {
    return isCompleteCombinedItem(getCombinedInputValues());
  }

  return getStepInputValue(currentStudentStep).length > 0;
}

function hasSubmittedCurrentStudentStep() {
  const response = getSelectedStudentResponse();
  if (currentStudentStep === "combined") {
    return normalizeCombinedList(response?.combined).length > 0;
  }

  return hasSubmittedStep(response, currentStudentStep);
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

async function goFromStudentToSee() {
  const studentNumber = normalizeStudentNumber(elements.studentNumberInput.value);
  if (!studentNumber) {
    showToast("1번부터 23번까지 입력해 주세요.");
    return;
  }

  selectedStudentNumber = String(studentNumber);
  await refreshActiveClassMode({ renderStudent: false });
  await refreshClassImage();
  await loadSelectedStudentResponse();
  showStudentStep(getStudentEntryStep());
  focusCurrentStepInput();
}

function getStudentEntryStep() {
  if (!activeClassMode) {
    return "waiting";
  }

  return activeClassMode === "combined" ? "combined" : activeClassStep;
}

function renderEmptyStepInputs() {
  resetAnswerLists();
  addSeeRow();
  renderThinkRows();
  renderWonderRows();
  renderCombinedRows();
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
      <textarea class="wonder-item single-response-input" rows="1" maxlength="120" placeholder="궁금한 것을 적어주세요.
(물음표로 끝나야 합니다)" autocomplete="off">${escapeHtml(value)}</textarea>
    </label>
  `;
  elements.wonderList.append(row);
  resizeTextareas(row);
}

function renderCombinedRows(values = {}) {
  elements.combinedList.innerHTML = "";
  const row = document.createElement("div");
  row.className = "combined-response-card";
  row.innerHTML = `
    <p>
      <span>저는</span>
      <input class="combined-see-item combined-inline-input" maxlength="80" placeholder="보기" autocomplete="off" value="${escapeAttribute(values.see || "")}" />
      <span>을/를 보고,</span>
    </p>
    <p>
      <input class="combined-think-item combined-inline-input" maxlength="120" placeholder="생각하기" autocomplete="off" value="${escapeAttribute(values.think || "")}" />
      <span>라고 생각합니다.</span>
    </p>
    <p>
      <span>그래서</span>
      <input class="combined-wonder-item combined-inline-input" maxlength="120" placeholder="궁금해하기" autocomplete="off" value="${escapeAttribute(values.wonder || "")}" />
      <span>가 궁금합니다.</span>
    </p>
  `;
  elements.combinedList.append(row);
  resizeTextareas(row);
}

function closeConfirmModal() {
  modalMode = "student";
  elements.confirmModal.hidden = true;
  elements.confirmModal.classList.remove("teacher-tools-locked");
  elements.confirmModal.classList.remove("student-results-modal");
  elements.modalSentenceList.innerHTML = "";
  elements.modalBackButton.hidden = false;
  elements.modalSubmitButton.textContent = "닫기";
}

function openClassImageLightbox() {
  if (!classImageDataUrl || !elements.classImageLightbox || !elements.classImageLightboxImage) return;

  elements.classImageLightboxImage.src = classImageDataUrl;
  elements.classImageLightbox.hidden = false;
  elements.classImageLightboxClose?.focus();
}

function closeClassImageLightbox() {
  if (!elements.classImageLightbox || !elements.classImageLightboxImage) return;

  elements.classImageLightbox.hidden = true;
  elements.classImageLightboxImage.removeAttribute("src");
  if (!elements.studentClassImageCard?.hidden) {
    elements.studentClassImageCard.focus();
  }
}

async function openStudentResults() {
  if (!hasSubmittedCurrentStudentStep()) {
    return;
  }

  try {
    await refreshResponses();
  } catch {
    return;
  }

  modalMode = "student-results";
  document.querySelector("#confirmModalTitle").textContent = currentStudentStep === "combined"
    ? "한 번에 작성 결과"
    : `${teacherSteps[currentStudentStep].label} 결과`;
  elements.modalBackButton.hidden = true;
  elements.modalSubmitButton.textContent = "닫기";
  elements.confirmModal.classList.remove("teacher-tools-locked");
  elements.confirmModal.classList.add("student-results-modal");
  elements.modalSentenceList.innerHTML = currentStudentStep === "combined"
    ? renderCombinedAnswers({ showDelete: false })
    : renderCollectedAnswers(currentStudentStep, { showDelete: false });
  elements.confirmModal.hidden = false;
  elements.modalSubmitButton.focus();
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

function getCombinedInputValues() {
  return {
    see: elements.combinedList.querySelector(".combined-see-item")?.value.trim() || "",
    think: elements.combinedList.querySelector(".combined-think-item")?.value.trim() || "",
    wonder: elements.combinedList.querySelector(".combined-wonder-item")?.value.trim() || "",
  };
}

function isCompleteCombinedItem(item) {
  return Boolean(item?.see && item?.think && item?.wonder);
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

function clearCombinedInputs() {
  elements.combinedList.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });
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
  elements.combinedList.innerHTML = "";
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

function focusFirstCombinedInput() {
  elements.combinedList.querySelector(".combined-see-item")?.focus();
}

function focusCurrentStepInput() {
  const focusByStep = {
    see: focusFirstSeeInput,
    think: focusFirstThinkInput,
    wonder: focusFirstWonderInput,
    combined: focusFirstCombinedInput,
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
  if (!isSupabaseReady()) {
    renderResponses();
    return;
  }

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
  teacherPollId = window.setInterval(async () => {
    await refreshActiveClassMode({ renderStudent: false });
    await refreshActiveClassStep({ renderStudent: false });
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
      refreshActiveClassMode();
      refreshActiveClassStep();
      refreshClassImage();
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

  if (!activeClassMode) {
    if (renderStudent && !elements.studentView.hidden && currentStudentStep !== "student" && currentStudentStep !== "waiting") {
      showStudentStep("waiting");
    }
    return activeClassStep;
  }

  if (activeClassMode === "combined") {
    if (renderStudent && !elements.studentView.hidden && currentStudentStep !== "student" && currentStudentStep !== "combined") {
      showStudentStep("combined");
      focusCurrentStepInput();
    }
    return activeClassStep;
  }

  if (renderStudent && !elements.studentView.hidden && currentStudentStep !== "student" && currentStudentStep !== activeClassStep) {
    showStudentStep(activeClassStep);
    focusCurrentStepInput();
  }

  return activeClassStep;
}

async function refreshActiveClassMode(options = {}) {
  const { renderStudent = true } = options;
  const previousMode = activeClassMode;

  try {
    activeClassMode = await loadActiveClassMode();
  } catch {
    activeClassMode = previousMode;
  }

  if (renderStudent && !elements.studentView.hidden && currentStudentStep !== "student") {
    const nextStep = getStudentEntryStep();
    if (currentStudentStep !== nextStep) {
      showStudentStep(nextStep);
      focusCurrentStepInput();
    }
  }

  return activeClassMode;
}

async function uploadClassImage(file) {
  if (!file) return;

  if (!isSupabaseReady()) {
    showToast("DB 설정이 필요합니다.");
    elements.classImageInput.value = "";
    return;
  }

  try {
    if (elements.classImageStatus) {
      elements.classImageStatus.textContent = "업로드 중입니다.";
    }
    const dataUrl = await prepareClassImage(file);
    await saveClassImageSetting(dataUrl);
    classImageDataUrl = dataUrl;
    renderClassImage();
    showToast("사진을 업로드했습니다.");
  } catch (error) {
    showToast(error.message || "사진을 업로드하지 못했습니다.");
    renderClassImage();
  } finally {
    elements.classImageInput.value = "";
  }
}

async function refreshClassImage() {
  const previousImage = classImageDataUrl;

  try {
    classImageDataUrl = await loadClassImageSetting();
  } catch {
    classImageDataUrl = previousImage;
  }

  renderClassImage();
  return classImageDataUrl;
}

function renderClassImage() {
  const hasImage = Boolean(classImageDataUrl);

  if (elements.classImagePreview) {
    elements.classImagePreview.hidden = !hasImage;
    if (hasImage) {
      elements.classImagePreview.src = classImageDataUrl;
    } else {
      elements.classImagePreview.removeAttribute("src");
    }
  }

  if (elements.classImageStatus) {
    elements.classImageStatus.textContent = hasImage ? "업로드 완료" : "4:3 사진을 업로드해 주세요.";
  }

  if (elements.studentClassImageCard && elements.studentClassImage) {
    const showForStudent = hasImage && currentStudentStep !== "student";
    elements.studentClassImageCard.hidden = !showForStudent;
    if (showForStudent) {
      elements.studentClassImage.src = classImageDataUrl;
    } else {
      elements.studentClassImage.removeAttribute("src");
    }
  }
}

async function loadClassImageSetting() {
  if (!isSupabaseReady()) {
    return classImageDataUrl;
  }

  const rows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(classImageSettingId)}&select=value&limit=1`
  );
  return rows[0]?.value || "";
}

async function saveClassImageSetting(value) {
  if (!isSupabaseReady()) {
    return;
  }

  const payload = {
    id: classImageSettingId,
    value,
    updated_at: new Date().toISOString(),
  };

  const existingRows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(classImageSettingId)}&select=id&limit=1`
  );

  if (existingRows[0]) {
    await supabaseRequest(`/${supabaseSettingsTable}?id=eq.${encodeURIComponent(classImageSettingId)}`, {
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

async function prepareClassImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("사진 파일만 업로드할 수 있습니다.");
  }

  const image = await loadImageFromFile(file);
  const ratio = image.naturalWidth / image.naturalHeight;
  if (Math.abs(ratio - classImageAspectRatio) > 0.03) {
    throw new Error("4:3 비율의 사진을 업로드해 주세요.");
  }

  const width = Math.min(classImageMaxWidth, image.naturalWidth);
  const height = Math.round(width / classImageAspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.82);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.addEventListener("load", () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    }, { once: true });

    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("사진을 읽지 못했습니다."));
    }, { once: true });

    image.src = objectUrl;
  });
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

async function loadActiveClassMode() {
  if (!isSupabaseReady()) {
    return activeClassMode;
  }

  const rows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(activeModeSettingId)}&select=value&limit=1`
  );
  const mode = rows[0]?.value;
  if (mode === "waiting") {
    return null;
  }
  return isClassMode(mode) ? mode : null;
}

async function saveActiveClassStep(step) {
  if (!isTeacherStep(step)) return;
  activeClassStep = step;

  if (!isSupabaseReady()) {
    return;
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

async function saveActiveClassMode(mode) {
  if (!isClassMode(mode)) return;
  activeClassMode = mode;

  await saveClassModeSetting(mode);
}

async function saveClassModeSetting(value) {
  if (!isSupabaseReady()) {
    return;
  }

  const payload = {
    id: activeModeSettingId,
    value,
    updated_at: new Date().toISOString(),
  };

  const existingRows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(activeModeSettingId)}&select=id&limit=1`
  );

  if (existingRows[0]) {
    await supabaseRequest(`/${supabaseSettingsTable}?id=eq.${encodeURIComponent(activeModeSettingId)}`, {
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

async function appendCombinedStep(value) {
  const studentName = getStudentName();
  const existingResponse = getResponseByStudentName(studentName);
  const existingValues = normalizeCombinedList(existingResponse?.combined);
  return await saveCombinedStep([...existingValues, value]);
}

async function saveCombinedStep(values) {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const studentName = getStudentName();
  const existingResponse = getResponseByStudentName(studentName);
  const payload = { combined: values };

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
    see: [],
    think: [],
    wonder: [],
    combined: values,
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
    combined: [],
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

async function deleteCombinedAnswer(responseId, answerIndex) {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const originalResponse = responses.find((item) => item.id === responseId);
  if (!originalResponse) {
    throw new Error("Answer not found");
  }

  const nextValues = normalizeCombinedList(originalResponse.combined).filter((_, index) => index !== answerIndex);
  try {
    const rows = await supabaseRequest(`/${supabaseTable}?id=eq.${encodeURIComponent(responseId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ combined: nextValues }),
    });
    if (!rows[0]) {
      throw new Error("Supabase update did not return a row");
    }

    const updatedResponse = fromSupabaseRow(rows[0]);
    responses = responses.map((item) => (item.id === responseId ? updatedResponse : item));
  } catch {
    await replaceResponseByInsert(originalResponse, { combined: nextValues });
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
    combined: response.combined || [],
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
    combined: normalizeCombinedList(row.combined),
    createdAt: row.created_at,
  };
}

function renderResponses() {
  elements.emptyState.hidden = true;
  elements.teacherModeTabs.innerHTML = "";
  elements.teacherModeTabs.hidden = true;
  elements.teacherTopTabs.innerHTML = "";
  elements.teacherTopTabs.hidden = activeClassMode !== "sequential";
  if (activeClassMode === "sequential") {
    elements.teacherTopTabs.append(renderTeacherTabs());
  }
  elements.responseList.innerHTML = "";
  elements.responseList.append(renderTeacherDashboard());
}

function renderTeacherDashboard() {
  const dashboard = document.createElement("section");
  dashboard.className = `teacher-dashboard is-${activeClassMode === "combined" ? "combined" : activeTeacherStep}`;
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
    ${activeClassMode === "combined" ? renderCombinedAnswers() : renderCollectedAnswers(activeTeacherStep)}
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
  panel.querySelectorAll("[data-delete-combined]").forEach((button) => {
    button.addEventListener("click", async () => {
      const responseId = button.dataset.responseId;
      const answerIndex = Number(button.dataset.answerIndex);
      if (!responseId || !Number.isInteger(answerIndex)) return;

      const card = button.closest(".postit-card");
      button.disabled = true;
      card?.classList.add("is-removing");
      await waitForCardExit(card);

      try {
        await deleteCombinedAnswer(responseId, answerIndex);
        renderResponses();
        showToast("답변을 지웠습니다.");
      } catch {
        button.disabled = false;
        card?.classList.remove("is-removing");
        showToast("답변을 지우지 못했습니다.");
      }
    });
  });
  panel.querySelectorAll("[data-student-name]").forEach((card) => {
    const openStudentResponse = () => {
      const studentName = card.dataset.studentName;
      if (!studentName) return;

      if (activeClassMode === "combined") {
        const answerIndex = Number(card.querySelector("[data-delete-combined]")?.dataset.answerIndex);
        openTeacherCombinedStudentModal(studentName, Number.isInteger(answerIndex) ? answerIndex : null);
      } else {
        const answerIndex = Number(card.querySelector("[data-delete-answer]")?.dataset.answerIndex);
        openTeacherStudentModal(studentName, activeTeacherStep, Number.isInteger(answerIndex) ? answerIndex : null);
      }
    };

    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openStudentResponse();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openStudentResponse();
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

function renderTeacherModeTabs() {
  const tabs = document.createElement("div");
  tabs.className = `teacher-mode-tab-list is-${activeClassMode}`;
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "활동 모드 선택");
  tabs.innerHTML = Object.entries(classModes)
    .map(([mode, label]) => `
      <button class="teacher-mode-tab ${mode === activeClassMode ? "is-selected" : ""}" type="button" role="tab" aria-selected="${mode === activeClassMode}" data-class-mode="${mode}">
        ${label}
      </button>
    `)
    .join("");

  tabs.querySelectorAll("[data-class-mode]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextMode = button.dataset.classMode;
      if (!isClassMode(nextMode)) return;

      activeClassMode = nextMode;
      if (nextMode === "sequential") {
        activeClassStep = "see";
        activeTeacherStep = "see";
      }
      renderResponses();

      try {
        await saveActiveClassMode(nextMode);
        if (nextMode === "sequential") {
          await saveActiveClassStep("see");
        }
      } catch {
        showToast("모드를 바꾸지 못했습니다.");
      }
    });
  });

  return tabs;
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
    const values = activeClassMode === "combined"
      ? normalizeCombinedList(response?.combined)
      : normalizeList(response?.[activeTeacherStep]).filter(Boolean);
    const submitted = values.length > 0;
    return `
      <button class="teacher-student-button ${submitted ? "is-submitted" : "is-empty"}" type="button" data-teacher-student="${index + 1}" ${submitted ? "" : "disabled"}>
        <span>${index + 1}</span>
      </button>
    `;
  }).join("");

  grid.querySelectorAll("[data-teacher-student]:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => {
      if (activeClassMode === "combined") {
        openTeacherCombinedStudentModal(`${button.dataset.teacherStudent}번`);
      } else {
        openTeacherStudentModal(`${button.dataset.teacherStudent}번`, activeTeacherStep);
      }
    });
  });

  return grid;
}

function renderCollectedAnswers(step, options = {}) {
  const { showDelete = true } = options;
  const cards = getCollectedStepAnswers(step);
  if (cards.length === 0) {
    return `<div class="teacher-step-empty">${teacherSteps[step].empty}</div>`;
  }

  return `
    <div class="teacher-postit-grid" aria-label="${teacherSteps[step].label} 전체 답변">
      ${cards
        .map((card, index) => `
          <article class="postit-card answer-${(index % answerAccentCount) + 1}" tabindex="0" role="button" data-student-name="${escapeAttribute(card.studentName)}" aria-label="${escapeAttribute(card.studentName)} 답변">
            ${showDelete ? `<button
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
            </button>` : ""}
            <div class="postit-content">${card.compact}</div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function renderCombinedAnswers(options = {}) {
  const { showDelete = true } = options;
  const cards = getCollectedCombinedAnswers();
  if (cards.length === 0) {
    return `<div class="teacher-step-empty">미제출</div>`;
  }

  return `
    <div class="teacher-postit-grid combined-postit-grid" aria-label="한 번에 작성 전체 답변">
      ${cards
        .map((card, index) => `
          <article class="postit-card combined-postit-card answer-${(index % answerAccentCount) + 1}" tabindex="0" role="button" data-student-name="${escapeAttribute(card.studentName)}" aria-label="${escapeAttribute(card.studentName)} 답변">
            ${showDelete ? `<button
              class="postit-delete-button"
              type="button"
              data-delete-combined
              data-response-id="${escapeAttribute(card.responseId)}"
              data-answer-index="${card.answerIndex}"
              aria-label="답변 지우기"
              title="지우기"
            >
              X
            </button>` : ""}
            <div class="postit-content combined-card-content">${renderCombinedSentence(card.value)}</div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function getCollectedCombinedAnswers() {
  return Array.from({ length: studentCount }, (_, index) => getResponseByStudentName(`${index + 1}번`))
    .filter(Boolean)
    .flatMap((response) =>
      normalizeCombinedList(response.combined).map((value, answerIndex) => ({
        responseId: response.id,
        studentName: response.name,
        answerIndex,
        value,
      }))
    );
}

function renderCombinedSentence(item) {
  return `
    <div class="combined-sentence">
      <p>
        <span class="combined-fixed-text">저는</span>
        <span class="combined-phrase">
          <span class="sentence-block see-block">${escapeHtml(item.see)}</span>
          <span class="combined-fixed-text">을/를 보고,</span>
        </span>
        <span class="combined-phrase">
          <span class="sentence-block think-block">${escapeHtml(item.think)}</span>
          <span class="combined-fixed-text">라고 생각합니다.</span>
        </span>
        <span class="combined-fixed-text">그래서</span>
        <span class="combined-phrase">
          <span class="sentence-block wonder-block">${escapeHtml(item.wonder)}</span>
          <span class="combined-fixed-text">가 궁금합니다.</span>
        </span>
      </p>
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
    studentName: response.name,
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

function openTeacherStudentModal(studentName, step, selectedAnswerIndex = null) {
  const response = getResponseByStudentName(studentName);
  if (!response) return;

  modalMode = "teacher";
  document.querySelector("#confirmModalTitle").textContent = studentName;
  elements.modalBackButton.hidden = true;
  elements.modalSubmitButton.textContent = "닫기";
  elements.confirmModal.classList.toggle("teacher-tools-locked", !teacherToolsUnlocked);
  elements.modalSentenceList.innerHTML = `
    <section class="teacher-response-set teacher-response-single">
      <button class="icon-delete-button" type="button" data-delete-response="${escapeAttribute(response.id)}" aria-label="학생 답변 비우기" title="비우기">
        삭제
      </button>
      ${renderStepResponse(response, step, selectedAnswerIndex)}
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

function openTeacherCombinedStudentModal(studentName, selectedAnswerIndex = null) {
  const response = getResponseByStudentName(studentName);
  if (!response) return;

  modalMode = "teacher";
  document.querySelector("#confirmModalTitle").textContent = studentName;
  elements.modalBackButton.hidden = true;
  elements.modalSubmitButton.textContent = "닫기";
  elements.confirmModal.classList.toggle("teacher-tools-locked", !teacherToolsUnlocked);
  elements.modalSentenceList.innerHTML = `
    <section class="teacher-response-set teacher-response-single">
      <button class="icon-delete-button" type="button" data-delete-response="${escapeAttribute(response.id)}" aria-label="학생 답변 비우기" title="비우기">
        삭제
      </button>
      ${renderCombinedValueCards(response.combined, selectedAnswerIndex)}
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

function renderCombinedValueCards(values, selectedAnswerIndex = null) {
  const submittedValues = normalizeCombinedList(values)
    .map((value, index) => ({ value, index }))
    .filter((item) => selectedAnswerIndex === null || item.index === selectedAnswerIndex);
  if (submittedValues.length === 0) {
    return `<div class="teacher-step-empty">미제출</div>`;
  }

  return `
    <div class="teacher-sentence-list" aria-label="한 번에 작성 결과">
      ${submittedValues
        .map(({ value, index }) => `
          <article class="combined-response-card combined-readonly-card answer-${index + 1}">
            ${renderReadonlyCombinedSentence(value)}
          </article>
        `)
        .join("")}
    </div>
  `;
}

function renderReadonlyCombinedSentence(item) {
  return `
    <p>
      <span>저는</span>
      <span class="combined-inline-value combined-see-item">${escapeHtml(item.see)}</span>
      <span>을/를 보고,</span>
    </p>
    <p>
      <span class="combined-inline-value combined-think-item">${escapeHtml(item.think)}</span>
      <span>라고 생각합니다.</span>
    </p>
    <p>
      <span>그래서</span>
      <span class="combined-inline-value combined-wonder-item">${escapeHtml(item.wonder)}</span>
      <span>가 궁금합니다.</span>
    </p>
  `;
}

function renderStepResponse(item, step, selectedAnswerIndex = null) {
  const seeItems = normalizeList(item.see);
  const thinkItems = normalizeList(item.think);
  const wonderItems = normalizeList(item.wonder);

  if (step === "see") {
    return renderValueCards(seeItems, "see", (value) => `<p><span class="sentence-block see-block">${escapeHtml(value)}</span></p>`, selectedAnswerIndex);
  }

  if (step === "think") {
    return renderValueCards(thinkItems, "think", (value) => `<p><span class="sentence-block think-block">${escapeHtml(value)}</span></p>`, selectedAnswerIndex);
  }

  return renderValueCards(wonderItems, "wonder", (value) => `<p><span class="sentence-block wonder-block">${escapeHtml(value)}</span></p>`, selectedAnswerIndex);
}

function renderValueCards(values, step, contentBuilder, selectedAnswerIndex = null) {
  const submittedValues = normalizeList(values)
    .map((value, index) => ({ value, index }))
    .filter((item) => item.value)
    .filter((item) => selectedAnswerIndex === null || item.index === selectedAnswerIndex);
  if (submittedValues.length === 0) {
    return `<div class="teacher-step-empty">${teacherSteps[step].empty}</div>`;
  }

  return `
    <div class="teacher-sentence-list" aria-label="${teacherSteps[step].label} 결과">
      ${submittedValues
        .map(({ value, index }) => `
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

function isClassMode(mode) {
  return Object.prototype.hasOwnProperty.call(classModes, mode);
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

function normalizeCombinedList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      see: String(item?.see || "").trim(),
      think: String(item?.think || "").trim(),
      wonder: String(item?.wonder || "").trim(),
    }))
    .filter(isCompleteCombinedItem);
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

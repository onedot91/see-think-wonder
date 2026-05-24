const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseTable = "stw_responses";
const supabaseSettingsTable = "stw_settings";
const activeStepSettingId = "active_step";
const activeModeSettingId = "active_mode";
const classImageSettingId = "class_image";
const summaryTextSettingId = "summary_text";
const presentationLockSettingId = "presentation_lock";
const responseClearCutoffSettingId = "response_clear_cutoff";
const savedStudentNumberKey = "stw_student_number";
const savedRoleKey = "stw_role";
const teacherRoleValue = "teacher";
const supabaseRestUrl = buildSupabaseRestUrl(supabaseUrl);
const studentCount = 23;
const answerAccentCount = 3;
const classImageMaxWidth = 1600;
const classImageJpegQuality = 0.9;
const classModes = {
  sequential: "순차 진행",
  combined: "한 번에 작성",
  summary: "헤드라인",
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
  teacherStartView: document.querySelector("#teacherStartView"),
  teacherSummarySetupView: document.querySelector("#teacherSummarySetupView"),
  teacherModeView: document.querySelector("#teacherModeView"),
  teacherView: document.querySelector("#teacherView"),
  teacherTitle: document.querySelector("#teacherView h1"),
  teacherClearTrigger: document.querySelector("#teacherClearTrigger"),
  teacherModeTabs: document.querySelector("#teacherModeTabs"),
  teacherTopTabs: document.querySelector("#teacherTopTabs"),
  studentView: document.querySelector("#studentView"),
  studentWaitingView: document.querySelector("#studentWaitingView"),
  teacherRoleButton: document.querySelector("#teacherRoleButton"),
  teacherStwStartButton: document.querySelector("#teacherStwStartButton"),
  teacherSummaryStartButton: document.querySelector("#teacherSummaryStartButton"),
  summaryTextInput: document.querySelector("#summaryTextInput"),
  summaryTextRegisterButton: document.querySelector("#summaryTextRegisterButton"),
  summaryTextStatus: document.querySelector("#summaryTextStatus"),
  summaryStartButton: document.querySelector("#summaryStartButton"),
  teacherModeChoiceButtons: document.querySelectorAll("[data-open-teacher-mode]"),
  classImageInput: document.querySelector("#classImageInput"),
  classImageCancelButton: document.querySelector("#classImageCancelButton"),
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
  studentFocusModal: document.querySelector("#studentFocusModal"),
  groupButtons: document.querySelector("#groupButtons"),
  studentNumberInput: document.querySelector("#studentNumberInput"),
  studentWaitingNumber: document.querySelector("#studentWaitingNumber"),
  studentWaitingPageNumber: document.querySelector("#studentWaitingPageNumber"),
  seeList: document.querySelector("#seeList"),
  thinkList: document.querySelector("#thinkList"),
  wonderList: document.querySelector("#wonderList"),
  combinedList: document.querySelector("#combinedList"),
  summaryList: document.querySelector("#summaryList"),
  responseList: document.querySelector("#responseList"),
  emptyState: document.querySelector("#emptyState"),
  confirmModal: document.querySelector("#confirmModal"),
  modalSentenceList: document.querySelector("#modalSentenceList"),
  modalBackButton: document.querySelector("#modalBackButton"),
  modalSubmitButton: document.querySelector("#modalSubmitButton"),
};

let responses = [];
let summaryResponses = {};
let selectedStudentNumber = "";
let currentStudentStep = "student";
let activeTeacherStep = "see";
let activeClassStep = "see";
let activeClassMode = null;
let classImageDataUrl = "";
let summaryText = "";
let activePresentationLock = false;
let responseClearCutoff = "";
let modalMode = "student";
let teacherPollId = null;
let studentStepPollId = null;
let isBackendOnline = false;
let teacherToolsClickCount = 0;
let teacherToolsUnlocked = false;
let teacherClearAllClickCount = 0;
let teacherClearAllUnlocked = false;

initStudentButtons();
initResponses();
restoreSavedSession();

elements.teacherRoleButton.addEventListener("click", () => showTeacherStartView());
elements.teacherStwStartButton?.addEventListener("click", () => showTeacherModeView());
elements.teacherSummaryStartButton?.addEventListener("click", () => showTeacherSummarySetupView());
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

elements.teacherClearTrigger?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (teacherClearAllUnlocked) return;

  teacherClearAllClickCount += 1;
  if (teacherClearAllClickCount >= 3) {
    teacherClearAllUnlocked = true;
    showToast("결과 내보내기 버튼을 표시합니다.");
    renderResponses();
  }
});

elements.changeRoleButtons.forEach((button) => {
  button.addEventListener("click", () => showRoleView());
});

elements.studentForm.addEventListener("input", (event) => {
  if (event.target instanceof HTMLTextAreaElement) {
    resizeTextarea(event.target);
    updateSingleResponseInputState(event.target);
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

elements.classImageCancelButton?.addEventListener("click", () => {
  cancelClassImageUpload();
});

elements.summaryTextInput?.addEventListener("input", () => {
  renderSummaryTextStatus();
});

elements.summaryTextInput?.addEventListener("paste", (event) => {
  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain") || "";
  insertPlainText(text);
});

elements.summaryTextRegisterButton?.addEventListener("click", () => {
  registerSummaryText();
});

elements.summaryStartButton?.addEventListener("click", () => {
  startSummaryClass();
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
  if (isReturnToStartShortcut(event)) {
    event.preventDefault();
    event.stopPropagation();
    clearSavedSession();
    showRoleView();
    return;
  }

  if (event.key === "Escape" && elements.classImageLightbox && !elements.classImageLightbox.hidden) {
    closeClassImageLightbox();
  }
}, { capture: true });

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
  if (currentStudentStep === "summary") {
    await submitSummaryStep();
    return;
  }
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

async function submitSummaryStep() {
  const headline = getSummaryInputValue();
  if (!getStudentName()) {
    showToast("학생 번호를 입력해 주세요.");
    return;
  }
  if (!headline) {
    showToast("글의 헤드라인을 써 주세요.");
    return;
  }

  try {
    await saveSummaryHeadline(getStudentName(), headline);
  } catch {
    showToast("헤드라인을 제출하지 못했습니다.");
    return;
  }

  clearSummaryInput();
  await refreshSummaryResponses();
  renderResponses();
  showToast(`${getStudentName()} 헤드라인 제출 완료`);
  focusSummaryInput();
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
  clearSavedRole();
  stopTeacherPolling();
  stopStudentStepPolling();
  closeConfirmModal();
  closeClassImageLightbox();
  elements.roleView.hidden = false;
  elements.teacherStartView.hidden = true;
  elements.teacherSummarySetupView.hidden = true;
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = true;
  elements.studentWaitingView.hidden = true;
  renderPresentationLock();
}

function isReturnToStartShortcut(event) {
  return event.ctrlKey && event.altKey && event.key === "Enter" && !event.isComposing;
}

async function showTeacherStartView() {
  saveTeacherRole();
  stopTeacherPolling();
  stopStudentStepPolling();
  closeConfirmModal();
  closeClassImageLightbox();
  savePresentationLockSetting(false).catch(() => {});
  await setClassWaitingMode();
  elements.roleView.hidden = true;
  elements.teacherStartView.hidden = false;
  elements.teacherSummarySetupView.hidden = true;
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = true;
  elements.studentWaitingView.hidden = true;
}

async function showTeacherSummarySetupView() {
  saveTeacherRole();
  stopTeacherPolling();
  stopStudentStepPolling();
  closeConfirmModal();
  closeClassImageLightbox();
  savePresentationLockSetting(false).catch(() => {});
  await setClassWaitingMode();
  await refreshSummaryText();
  elements.roleView.hidden = true;
  elements.teacherStartView.hidden = true;
  elements.teacherSummarySetupView.hidden = false;
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = true;
  elements.studentWaitingView.hidden = true;
  elements.summaryTextInput?.focus();
}

async function showTeacherModeView() {
  saveTeacherRole();
  stopTeacherPolling();
  stopStudentStepPolling();
  closeConfirmModal();
  savePresentationLockSetting(false).catch(() => {});
  await setClassWaitingMode();
  refreshClassImage();
  elements.roleView.hidden = true;
  elements.teacherStartView.hidden = true;
  elements.teacherSummarySetupView.hidden = true;
  elements.teacherModeView.hidden = false;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = true;
  elements.studentWaitingView.hidden = true;
}

async function setClassWaitingMode() {
  activeClassMode = null;
  if (isSupabaseReady()) {
    try {
      await saveClassModeSetting("waiting");
    } catch {
      showToast("대기 상태를 저장하지 못했습니다.");
    }
  }
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
  await refreshClassImage();
  await refreshSummaryText();
  activeTeacherStep = activeClassStep;
  await refreshResponses();
  startTeacherPolling();
  elements.roleView.hidden = true;
  elements.teacherStartView.hidden = true;
  elements.teacherSummarySetupView.hidden = true;
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = false;
  elements.studentView.hidden = true;
  elements.studentWaitingView.hidden = true;
  renderPresentationLock();
}

function showStudentView() {
  clearSavedRole();
  stopTeacherPolling();
  if (restoreSavedStudentSession()) {
    return;
  }

  resetStudentForm();
  activeClassMode = null;
  elements.roleView.hidden = true;
  elements.teacherStartView.hidden = true;
  elements.teacherSummarySetupView.hidden = true;
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = false;
  elements.studentWaitingView.hidden = true;
  elements.studentNumberInput?.focus();
  refreshClassImage();
  refreshPresentationLock();
  refreshActiveClassMode();
  refreshActiveClassStep();
  startStudentStepPolling();
}

function showStudentStep(step) {
  let activeSection = null;
  const previousStudentStep = currentStudentStep;
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
    summary: { icon: "✍", text: "헤드라인 작성하기" },
    waiting: { icon: "", text: "대기 중" },
  };
  const title = titles[step] || titles.student;
  elements.studentStepTitle.innerHTML = title.icon
    ? `<span class="step-title-icon" aria-hidden="true">${title.icon}</span><span class="step-title-text">${title.text}</span>`
    : `<span class="step-title-text">${title.text}</span>`;
  renderWaitingStudentNumber();
  renderClassImage();
  animateClassImageEntrance(step, previousStudentStep);
  updateStudentTopActions(step);

  if (activeSection) {
    window.requestAnimationFrame(() => {
      activeSection.classList.add("is-entering");
    });
  }
}

function animateClassImageEntrance(step, previousStep) {
  const isFirstAnswerStep = step === "see" || step === "combined";
  const isEnteringFromStart = previousStep === "student" || previousStep === "waiting";
  if (!elements.studentView || !classImageDataUrl || !isFirstAnswerStep || !isEnteringFromStart) {
    elements.studentView?.classList.remove("is-image-entering");
    return;
  }

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
    summary: { prev: false, next: "제출" },
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
  const isAnswerStep = isTeacherStep(currentStudentStep) || currentStudentStep === "combined" || currentStudentStep === "summary";

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
  if (currentStudentStep === "summary") {
    return getSummaryInputValue().length > 0;
  }

  if (currentStudentStep === "combined") {
    return isCompleteCombinedItem(getCombinedInputValues());
  }

  return getStepInputValue(currentStudentStep).length > 0;
}

function hasSubmittedCurrentStudentStep() {
  const response = getSelectedStudentResponse();
  if (currentStudentStep === "summary") {
    return Boolean(getSummaryHeadline(getStudentName()));
  }

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
  saveSelectedStudentNumber(selectedStudentNumber);
  await refreshActiveClassMode({ renderStudent: false });
  await refreshClassImage();
  await refreshSummaryText();
  await loadSelectedStudentResponse();
  const entryStep = getStudentEntryStep();
  if (entryStep === "waiting") {
    showStudentWaitingView();
    return;
  }

  showStudentAnswerView(entryStep);
}

function getStudentEntryStep() {
  if (!activeClassMode) {
    return "waiting";
  }

  if (activeClassMode === "summary") {
    return "summary";
  }

  return activeClassMode === "combined" ? "combined" : activeClassStep;
}

function renderEmptyStepInputs() {
  resetAnswerLists();
  addSeeRow();
  renderThinkRows();
  renderWonderRows();
  renderCombinedRows();
  renderSummaryRows();
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
  updateSingleResponseInputState(row.querySelector(".single-response-input"));
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
  updateSingleResponseInputState(row.querySelector(".single-response-input"));
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
  updateSingleResponseInputState(row.querySelector(".single-response-input"));
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

function renderSummaryRows(value = "") {
  elements.summaryList.innerHTML = "";
  const row = document.createElement("div");
  row.className = "summary-response-card";
  row.innerHTML = `
    <label class="summary-headline-field">
      <textarea class="summary-item summary-headline-input" rows="1" maxlength="120" placeholder="글의 헤드라인을 써 주세요." autocomplete="off">${escapeHtml(value)}</textarea>
    </label>
    <article class="summary-reading-card">
      ${renderSummaryReadingText(summaryText)}
    </article>
  `;
  elements.summaryList.append(row);
  resizeTextareas(row);
}

function closeConfirmModal() {
  const shouldReleasePresentationLock = modalMode === "teacher";
  modalMode = "student";
  elements.confirmModal.hidden = true;
  elements.confirmModal.classList.remove("teacher-tools-locked");
  elements.confirmModal.classList.remove("student-results-modal");
  elements.confirmModal.classList.remove("teacher-answer-modal");
  elements.modalSentenceList.innerHTML = "";
  elements.modalBackButton.hidden = false;
  elements.modalSubmitButton.textContent = "닫기";
  if (shouldReleasePresentationLock) {
    savePresentationLockSetting(false).catch(() => {});
  }
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
    : currentStudentStep === "summary"
      ? "헤드라인 결과"
      : `${teacherSteps[currentStudentStep].label} 결과`;
  elements.modalBackButton.hidden = true;
  elements.modalSubmitButton.textContent = "닫기";
  elements.confirmModal.classList.remove("teacher-tools-locked");
  elements.confirmModal.classList.add("student-results-modal");
  elements.modalSentenceList.innerHTML = currentStudentStep === "combined"
    ? renderCombinedAnswers({ showDelete: false })
    : currentStudentStep === "summary"
      ? renderSummaryAnswers({ showDelete: false })
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

function getSummaryInputValue() {
  return elements.summaryList.querySelector(".summary-item")?.value.trim() || "";
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
  updateSingleResponseInputState(input);
  resizeTextarea(input);
  updateStudentSubmitState();
}

function updateSingleResponseInputState(input) {
  if (!input) return;

  const hasValue = input.value.trim().length > 0;
  input.classList.toggle("has-value", hasValue);
  input.classList.toggle("is-empty", !hasValue);
}

function clearCombinedInputs() {
  elements.combinedList.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });
  updateStudentSubmitState();
}

function clearSummaryInput() {
  const input = elements.summaryList.querySelector(".summary-item");
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

function restoreSavedSession() {
  if (loadSavedRole() === teacherRoleValue) {
    showTeacherStartView();
    return true;
  }

  return restoreSavedStudentSession();
}

function restoreSavedStudentSession() {
  const savedStudentNumber = loadSavedStudentNumber();
  if (!savedStudentNumber) {
    return false;
  }

  selectedStudentNumber = String(savedStudentNumber);
  if (elements.studentNumberInput) {
    elements.studentNumberInput.value = selectedStudentNumber;
  }
  renderEmptyStepInputs();
  showStudentWaitingView();
  return true;
}

function showStudentWaitingView() {
  stopTeacherPolling();
  currentStudentStep = "waiting";
  elements.roleView.hidden = true;
  elements.teacherStartView.hidden = true;
  elements.teacherSummarySetupView.hidden = true;
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = true;
  elements.studentView.hidden = true;
  elements.studentWaitingView.hidden = false;
  renderWaitingStudentNumber();
  refreshPresentationLock();
  refreshActiveClassMode();
  refreshActiveClassStep();
  startStudentStepPolling();
}

function showStudentAnswerView(step) {
  elements.roleView.hidden = true;
  elements.teacherStartView.hidden = true;
  elements.teacherSummarySetupView.hidden = true;
  elements.teacherModeView.hidden = true;
  elements.teacherView.hidden = true;
  elements.studentWaitingView.hidden = true;
  elements.studentView.hidden = false;
  refreshClassImage();
  showStudentStep(step);
  focusCurrentStepInput();
  startStudentStepPolling();
}

function renderWaitingStudentNumber() {
  const label = selectedStudentNumber ? `${selectedStudentNumber}번` : "";
  if (elements.studentWaitingNumber) {
    elements.studentWaitingNumber.textContent = label;
  }
  if (elements.studentWaitingPageNumber) {
    elements.studentWaitingPageNumber.textContent = label;
  }
}

function saveSelectedStudentNumber(studentNumber) {
  try {
    window.localStorage.setItem(savedStudentNumberKey, String(studentNumber));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function clearSavedSession() {
  clearSavedRole();
  clearSavedStudentNumber();
}

function saveTeacherRole() {
  try {
    window.localStorage.setItem(savedRoleKey, teacherRoleValue);
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function clearSavedRole() {
  try {
    window.localStorage.removeItem(savedRoleKey);
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function clearSavedStudentNumber() {
  try {
    window.localStorage.removeItem(savedStudentNumberKey);
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function loadSavedRole() {
  try {
    return window.localStorage.getItem(savedRoleKey);
  } catch {
    return null;
  }
}

function loadSavedStudentNumber() {
  try {
    const savedNumber = normalizeStudentNumber(window.localStorage.getItem(savedStudentNumberKey));
    if (savedNumber) return savedNumber;
    window.localStorage.removeItem(savedStudentNumberKey);
  } catch {
    return null;
  }
  return null;
}

function resetAnswerLists() {
  elements.seeList.innerHTML = "";
  elements.thinkList.innerHTML = "";
  elements.wonderList.innerHTML = "";
  elements.combinedList.innerHTML = "";
  elements.summaryList.innerHTML = "";
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

function focusSummaryInput() {
  elements.summaryList.querySelector(".summary-item")?.focus();
}

function focusCurrentStepInput() {
  const focusByStep = {
    see: focusFirstSeeInput,
    think: focusFirstThinkInput,
    wonder: focusFirstWonderInput,
    combined: focusFirstCombinedInput,
    summary: focusSummaryInput,
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
    await refreshSummaryResponses();
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
    await refreshClassImage();
    await refreshSummaryText();
    await refreshSummaryResponses();
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
    if (isStudentSessionVisible()) {
      refreshActiveClassMode();
      refreshActiveClassStep();
      refreshClassImage();
      refreshSummaryText();
      refreshPresentationLock();
    }
  }, 2000);
}

function stopStudentStepPolling() {
  if (!studentStepPollId) return;
  window.clearInterval(studentStepPollId);
  studentStepPollId = null;
}

function isStudentSessionVisible() {
  return !elements.studentView.hidden || !elements.studentWaitingView.hidden;
}

async function loadResponses() {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  responseClearCutoff = await loadResponseClearCutoffSetting();
  const rows = await supabaseRequest(`/${supabaseTable}?select=*&order=created_at.asc`);
  return rows.map(fromSupabaseRow).filter(isAfterResponseClearCutoff);
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
      showStudentWaitingView();
    }
    return activeClassStep;
  }

  if (activeClassMode === "summary") {
    await refreshSummaryText();
    if (renderStudent && !elements.studentWaitingView.hidden) {
      showStudentAnswerView("summary");
      return activeClassStep;
    }
    if (renderStudent && !elements.studentView.hidden && currentStudentStep !== "student" && currentStudentStep !== "summary") {
      showStudentStep("summary");
      focusCurrentStepInput();
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

  if (renderStudent && !elements.studentWaitingView.hidden && activeClassMode) {
    showStudentAnswerView(getStudentEntryStep());
    return activeClassMode;
  }

  if (renderStudent && !elements.studentView.hidden && currentStudentStep !== "student" && !activeClassMode) {
    showStudentWaitingView();
    return activeClassMode;
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

async function cancelClassImageUpload() {
  if (!classImageDataUrl) return;

  if (!isSupabaseReady()) {
    showToast("DB 설정이 필요합니다.");
    return;
  }

  try {
    await saveClassImageSetting("");
    classImageDataUrl = "";
    closeClassImageLightbox();
    renderClassImage();
    showToast("업로드를 취소했습니다.");
  } catch {
    showToast("업로드를 취소하지 못했습니다.");
  }
}

async function registerSummaryText(options = {}) {
  const nextText = getSummaryEditorText();
  if (!nextText) {
    showToast("수업에서 사용할 글을 넣어 주세요.");
    elements.summaryTextInput?.focus();
    return false;
  }

  try {
    summaryText = nextText;
    await saveSummaryTextSetting(summaryText);
    renderSummaryTextStatus();
    if (!options.silent) {
      showToast("글을 등록했습니다.");
    }
    return true;
  } catch {
    showToast("글을 등록하지 못했습니다.");
    return false;
  }
}

async function startSummaryClass() {
  const registered = await registerSummaryText({ silent: true });
  if (!registered) {
    return;
  }

  try {
    await saveActiveClassMode("summary");
    await refreshResponses();
    await showTeacherView("summary");
    showToast("헤드라인을 시작했습니다.");
  } catch {
    showToast("헤드라인을 시작하지 못했습니다.");
  }
}

async function refreshSummaryText() {
  const previousText = summaryText;

  try {
    summaryText = await loadSummaryTextSetting();
  } catch {
    summaryText = previousText;
  }

  renderSummaryText();
  return summaryText;
}

function renderSummaryText() {
  if (elements.summaryTextInput && getSummaryEditorText() !== summaryText) {
    setSummaryEditorText(summaryText);
  }
  if (currentStudentStep === "summary") {
    const readingCard = elements.summaryList.querySelector(".summary-reading-card");
    if (readingCard) {
      readingCard.innerHTML = renderSummaryReadingText(summaryText);
    } else {
      renderSummaryRows();
    }
  }
  renderSummaryTextStatus();
}

function renderSummaryTextStatus() {
  if (!elements.summaryTextStatus) return;
  const inputText = getSummaryEditorText();
  if (!inputText) {
    elements.summaryTextStatus.textContent = "글을 입력해 주세요.";
    return;
  }
  elements.summaryTextStatus.textContent = inputText === summaryText ? "등록 완료" : "등록해 주세요.";
}

function getSummaryEditorText() {
  if (!elements.summaryTextInput) return "";
  return normalizeEditableText(elements.summaryTextInput.innerText || elements.summaryTextInput.textContent || "");
}

function setSummaryEditorText(value) {
  if (!elements.summaryTextInput) return;
  elements.summaryTextInput.innerHTML = renderSummaryReadingText(value, { emptyText: "" });
}

function insertPlainText(text) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  selection.deleteFromDocument();
  selection.getRangeAt(0).insertNode(document.createTextNode(text));
  selection.collapseToEnd();
  setSummaryEditorText(getSummaryEditorText());
  renderSummaryTextStatus();
}

function normalizeEditableText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function renderSummaryReadingText(value, options = {}) {
  const { emptyText = "등록된 글이 없습니다." } = options;
  const paragraphs = String(value || "")
    .trim()
    .split(/\n\s*\n|\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return emptyText ? `<p class="summary-reading-paragraph is-empty">${escapeHtml(emptyText)}</p>` : "";
  }

  return paragraphs
    .map((paragraph) => `<p class="summary-reading-paragraph">${escapeHtml(paragraph)}</p>`)
    .join("");
}

async function loadSummaryTextSetting() {
  if (!isSupabaseReady()) {
    return summaryText;
  }

  const rows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(summaryTextSettingId)}&select=value&limit=1`
  );
  return rows[0]?.value || "";
}

async function saveSummaryTextSetting(value) {
  if (!isSupabaseReady()) {
    return;
  }

  const payload = {
    id: summaryTextSettingId,
    value,
    updated_at: new Date().toISOString(),
  };

  const existingRows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(summaryTextSettingId)}&select=id&limit=1`
  );

  if (existingRows[0]) {
    await supabaseRequest(`/${supabaseSettingsTable}?id=eq.${encodeURIComponent(summaryTextSettingId)}`, {
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

async function refreshSummaryResponses() {
  if (!isSupabaseReady()) {
    return summaryResponses;
  }

  const rows = await supabaseRequest(`/${supabaseSettingsTable}?select=id,value,updated_at`);
  summaryResponses = rows
    .filter((row) => /^summary_response_\d+$/.test(row.id || ""))
    .reduce((items, row) => {
      const number = Number(row.id.replace("summary_response_", ""));
      if (number >= 1 && number <= studentCount && row.value) {
        items[`${number}번`] = row.value;
      }
      return items;
    }, {});
  return summaryResponses;
}

async function saveSummaryHeadline(studentName, value) {
  const settingId = getSummaryResponseSettingId(studentName);
  if (!settingId || !isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  await saveSettingsValue(settingId, value);
  summaryResponses = {
    ...summaryResponses,
    [studentName]: value,
  };
}

async function deleteSummaryHeadline(studentName) {
  const settingId = getSummaryResponseSettingId(studentName);
  if (!settingId || !isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  await saveSettingsValue(settingId, "");
  const nextResponses = { ...summaryResponses };
  delete nextResponses[studentName];
  summaryResponses = nextResponses;
}

function getSummaryHeadline(studentName) {
  return summaryResponses[studentName] || "";
}

function getSummaryResponseSettingId(studentName) {
  const match = /^(\d+)번$/.exec(studentName || "");
  if (!match) return "";
  return `summary_response_${match[1]}`;
}

async function saveSettingsValue(id, value) {
  const payload = {
    id,
    value,
    updated_at: new Date().toISOString(),
  };

  const existingRows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(id)}&select=id&limit=1`
  );

  if (existingRows[0]) {
    await supabaseRequest(`/${supabaseSettingsTable}?id=eq.${encodeURIComponent(id)}`, {
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

async function refreshPresentationLock() {
  const previousLock = activePresentationLock;

  try {
    activePresentationLock = await loadPresentationLockSetting();
  } catch {
    activePresentationLock = previousLock;
  }

  renderPresentationLock();
  return activePresentationLock;
}

function renderPresentationLock() {
  if (!elements.studentFocusModal) return;
  elements.studentFocusModal.hidden = !activePresentationLock || elements.studentView.hidden;
}

async function loadPresentationLockSetting() {
  if (!isSupabaseReady()) {
    return activePresentationLock;
  }

  const rows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(presentationLockSettingId)}&select=value&limit=1`
  );
  return rows[0]?.value === "on";
}

async function savePresentationLockSetting(isLocked) {
  activePresentationLock = Boolean(isLocked);
  renderPresentationLock();

  if (!isSupabaseReady()) {
    return;
  }

  const payload = {
    id: presentationLockSettingId,
    value: isLocked ? "on" : "off",
    updated_at: new Date().toISOString(),
  };

  const existingRows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(presentationLockSettingId)}&select=id&limit=1`
  );

  if (existingRows[0]) {
    await supabaseRequest(`/${supabaseSettingsTable}?id=eq.${encodeURIComponent(presentationLockSettingId)}`, {
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
    elements.classImageStatus.textContent = hasImage ? "업로드 완료" : "사진을 업로드해 주세요.";
  }

  if (elements.classImageCancelButton) {
    elements.classImageCancelButton.hidden = !hasImage;
  }

  if (elements.studentClassImageCard && elements.studentClassImage) {
    const showForStudent = hasImage && activeClassMode !== "summary" && currentStudentStep !== "student";
    elements.studentClassImageCard.hidden = !showForStudent;
    if (showForStudent) {
      elements.studentClassImage.src = classImageDataUrl;
    } else {
      elements.studentClassImage.removeAttribute("src");
    }
  }

  const teacherClassImageCard = document.querySelector("#teacherDashboardClassImageCard");
  const teacherClassImage = document.querySelector("#teacherDashboardClassImage");
  if (teacherClassImageCard && teacherClassImage) {
    teacherClassImageCard.hidden = !hasImage;
    if (hasImage) {
      teacherClassImage.src = classImageDataUrl;
    } else {
      teacherClassImage.removeAttribute("src");
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
  const width = Math.min(classImageMaxWidth, image.naturalWidth);
  const height = Math.round(width * (image.naturalHeight / image.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", classImageJpegQuality);
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
  await refreshResponsesCache();
  const studentName = getStudentName();
  const existingResponse = getResponseByStudentName(studentName);
  const existingValues = normalizeList(existingResponse?.[step]).filter(Boolean);
  return await saveStudentStep(step, [...existingValues, value]);
}

async function appendCombinedStep(value) {
  await refreshResponsesCache();
  const studentName = getStudentName();
  const existingResponse = getResponseByStudentName(studentName);
  const existingValues = normalizeCombinedList(existingResponse?.combined);
  return await saveCombinedStep([...existingValues, value]);
}

async function refreshResponsesCache() {
  responses = await loadResponses();
}

async function loadResponseClearCutoffSetting() {
  if (!isSupabaseReady()) {
    return responseClearCutoff;
  }

  const rows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(responseClearCutoffSettingId)}&select=value&limit=1`
  );
  return rows[0]?.value || "";
}

async function saveResponseClearCutoffSetting(value) {
  if (!isSupabaseReady()) {
    return;
  }

  const payload = {
    id: responseClearCutoffSettingId,
    value,
    updated_at: new Date().toISOString(),
  };

  const existingRows = await supabaseRequest(
    `/${supabaseSettingsTable}?id=eq.${encodeURIComponent(responseClearCutoffSettingId)}&select=id&limit=1`
  );

  if (existingRows[0]) {
    await supabaseRequest(`/${supabaseSettingsTable}?id=eq.${encodeURIComponent(responseClearCutoffSettingId)}`, {
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
        responses = responses.filter((item) => item.id !== existingResponse.id);
        return await insertCombinedResponse(studentName, values);
      }
      const updatedResponse = fromSupabaseRow(rows[0]);
      responses = responses.map((item) => (item.id === updatedResponse.id ? updatedResponse : item));
      return updatedResponse;
    } catch {
      return await replaceResponseByInsert(existingResponse, payload);
    }
  }

  return await insertCombinedResponse(studentName, values);
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
        responses = responses.filter((item) => item.id !== existingResponse.id);
        return await insertStepResponse(studentName, step, values);
      }
      const updatedResponse = fromSupabaseRow(rows[0]);
      responses = responses.map((item) => (item.id === updatedResponse.id ? updatedResponse : item));
      return updatedResponse;
    } catch {
      return await replaceResponseByInsert(existingResponse, payload);
    }
  }

  return await insertStepResponse(studentName, step, values);
}

async function insertCombinedResponse(studentName, values) {
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
  responses = [...responses, createdResponse];
  return createdResponse;
}

async function insertStepResponse(studentName, step, values) {
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
  responses = [...responses, createdResponse];
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
  responses = responses.map((item) => (item.id === existingResponse.id ? updatedResponse : item));
  return updatedResponse;
}

async function clearResponses() {
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const cutoff = new Date().toISOString();
  await saveResponseClearCutoffSetting(cutoff);
  responseClearCutoff = cutoff;
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

function isAfterResponseClearCutoff(response) {
  if (!responseClearCutoff) return true;
  const responseTime = Date.parse(response?.createdAt || "");
  const cutoffTime = Date.parse(responseClearCutoff);
  if (!Number.isFinite(responseTime) || !Number.isFinite(cutoffTime)) return true;
  return responseTime > cutoffTime;
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
  elements.responseList.append(activeClassMode === "summary" ? renderSummaryDashboard() : renderTeacherDashboard());
}

function renderTeacherDashboard() {
  const dashboard = document.createElement("section");
  dashboard.className = `teacher-dashboard is-${activeClassMode === "combined" ? "combined" : activeTeacherStep}`;
  dashboard.append(renderTeacherDashboardActions());
  dashboard.append(renderTeacherClassImagePanel());
  dashboard.append(renderTeacherDashboardBody());
  return dashboard;
}

function renderSummaryDashboard() {
  const dashboard = document.createElement("section");
  dashboard.className = "teacher-dashboard is-summary";
  dashboard.append(renderSummaryTextPanel(), renderSummaryResultPanel());
  return dashboard;
}

function renderSummaryTextPanel() {
  const panel = document.createElement("section");
  panel.className = "teacher-dashboard-panel summary-text-panel";
  panel.innerHTML = `
    <h2>수업 글</h2>
    <div class="summary-reading-text">${renderSummaryReadingText(summaryText)}</div>
  `;
  return panel;
}

function renderSummaryResultPanel() {
  const panel = document.createElement("section");
  panel.className = "teacher-dashboard-panel summary-result-panel";
  panel.innerHTML = `
    <h2>번호별 결과</h2>
    <div class="teacher-student-grid summary-student-grid">
      ${Array.from({ length: studentCount }, (_, index) => {
        const studentName = `${index + 1}번`;
        const submitted = Boolean(getSummaryHeadline(studentName));
        return `
        <button class="teacher-student-button ${submitted ? "is-submitted" : "is-empty"}" type="button" data-summary-student="${index + 1}" ${submitted ? "" : "disabled"}>
          <span>${index + 1}</span>
        </button>`;
      }).join("")}
    </div>
  `;
  panel.querySelectorAll("[data-summary-student]:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => {
      openTeacherSummaryStudentModal(`${button.dataset.summaryStudent}번`);
    });
  });
  return panel;
}

function renderTeacherClassImagePanel() {
  const panel = document.createElement("figure");
  panel.className = "teacher-dashboard-image-card";
  panel.id = "teacherDashboardClassImageCard";
  panel.tabIndex = 0;
  panel.setAttribute("role", "button");
  panel.setAttribute("aria-label", "수업 사진 크게 보기");
  panel.hidden = !classImageDataUrl;
  panel.innerHTML = `<img id="teacherDashboardClassImage" alt="수업 사진" />`;

  const image = panel.querySelector("img");
  if (image && classImageDataUrl) {
    image.src = classImageDataUrl;
  }

  panel.addEventListener("click", () => {
    openClassImageLightbox();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openClassImageLightbox();
    }
  });

  return panel;
}

function renderTeacherDashboardActions() {
  const actions = document.createElement("div");
  actions.className = "teacher-dashboard-actions";
  actions.innerHTML = `
    <button class="danger-button teacher-export-clear-button" type="button" ${teacherClearAllUnlocked ? "" : "hidden"} ${responses.length === 0 ? "disabled" : ""}>
      결과 내보내기
    </button>
  `;

  actions.querySelector(".teacher-export-clear-button")?.addEventListener("click", async (event) => {
    if (responses.length === 0) return;
    const modeLabel = activeClassMode === "combined" ? "한 번에 작성" : "순차 진행";
    const confirmed = window.confirm(`${modeLabel} 결과만 HTML 파일로 저장한 뒤 모든 학생 결과를 삭제할까요?`);
    if (!confirmed) return;

    const button = event.currentTarget;
    button.disabled = true;

    try {
      exportResponsesAsHtml();
      await clearResponses();
      renderResponses();
      showToast("결과를 저장하고 전부 삭제했습니다.");
    } catch {
      button.disabled = false;
      showToast("결과를 내보내거나 삭제하지 못했습니다.");
    }
  });

  return actions;
}

function exportResponsesAsHtml() {
  const exportedAt = new Date();
  const mode = activeClassMode === "combined" ? "combined" : "sequential";
  const fileName = `see-think-wonder-${mode}-results-${formatFileDate(exportedAt)}.html`;
  const html = buildResponsesExportHtml(exportedAt, mode);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildResponsesExportHtml(exportedAt, mode) {
  const submittedResponses = getSubmittedStudentResponses();
  const sequentialResponses = submittedResponses.filter(hasSequentialAnswers);
  const combinedResponses = submittedResponses.filter((response) => normalizeCombinedList(response.combined).length > 0);
  const isCombinedExport = mode === "combined";
  const stepCounts = {
    see: countStepAnswers("see", submittedResponses),
    think: countStepAnswers("think", submittedResponses),
    wonder: countStepAnswers("wonder", submittedResponses),
    combined: submittedResponses.reduce((sum, response) => sum + normalizeCombinedList(response.combined).length, 0),
  };
  const exportTitle = isCombinedExport ? "한 번에 작성 결과" : "순차 진행 결과";
  const exportSummary = isCombinedExport
    ? `<span>제출 학생 ${combinedResponses.length}명</span><span>한 번에 작성 ${stepCounts.combined}개</span>`
    : `<span>제출 학생 ${sequentialResponses.length}명</span><span>보기 ${stepCounts.see}개</span><span>생각하기 ${stepCounts.think}개</span><span>궁금해하기 ${stepCounts.wonder}개</span>`;
  const exportBody = isCombinedExport
    ? renderCombinedExportBody(combinedResponses)
    : renderSequentialExportBody(sequentialResponses);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>사고루틴 결과</title>
  <style>
    body { margin: 0; padding: 32px; color: #111; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    h2 { margin: 32px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #111; font-size: 24px; }
    h3 { margin: 18px 0 8px; font-size: 18px; }
    .meta, .summary { color: #444; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 24px; }
    .summary span { padding: 6px 10px; border: 1px solid #ccc; border-radius: 999px; }
    .class-image { width: min(720px, 100%); margin: 24px 0; padding: 12px; border: 2px solid #111; border-radius: 12px; }
    .class-image img { display: block; width: 100%; border-radius: 8px; object-fit: contain; }
    .export-section { margin-top: 36px; }
    .student { break-inside: avoid; margin: 22px 0; padding: 18px; border: 2px solid #111; border-radius: 12px; }
    .student-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; margin-bottom: 10px; }
    .student-name { font-size: 22px; font-weight: 800; }
    .submitted-at { color: #555; font-size: 14px; }
    ol { margin: 0 0 10px 24px; padding: 0; }
    li { margin: 5px 0; }
    .combined-item { margin: 8px 0; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px; }
    .empty { color: #777; }
    @media print { body { padding: 18mm; } .student { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>사고루틴 ${exportTitle}</h1>
  <div class="meta">내보낸 시간: ${escapeHtml(formatReadableDate(exportedAt))}</div>
  <div class="summary">
    ${exportSummary}
  </div>
  ${mode !== "summary" && classImageDataUrl ? `<figure class="class-image"><img src="${escapeAttribute(classImageDataUrl)}" alt="수업 사진"></figure>` : ""}
  ${exportBody}
</body>
</html>`;
}

function renderSequentialExportBody(responsesForExport) {
  return `
  <section class="export-section">
    <h2>순차 진행</h2>
    ${responsesForExport.length === 0 ? `<p class="empty">저장할 순차 진행 결과가 없습니다.</p>` : responsesForExport.map((response, index) => renderSequentialExportSection(response, index)).join("")}
  </section>`;
}

function renderCombinedExportBody(responsesForExport) {
  return `
  <section class="export-section">
    <h2>한 번에 작성</h2>
    ${responsesForExport.length === 0 ? `<p class="empty">저장할 한 번에 작성 결과가 없습니다.</p>` : responsesForExport.map((response, index) => renderCombinedResponseExportSection(response, index)).join("")}
  </section>`;
}

function renderSequentialExportSection(response, index) {
  const seeItems = normalizeList(response.see).filter(Boolean);
  const thinkItems = normalizeList(response.think).filter(Boolean);
  const wonderItems = normalizeList(response.wonder).filter(Boolean);

  return `
  <section class="student">
    <div class="student-head">
      <span class="student-name">${index + 1}. ${escapeHtml(response.name)}</span>
      <span class="submitted-at">제출: ${escapeHtml(formatReadableDate(response.createdAt))}</span>
    </div>
    ${renderExportList("보기", seeItems)}
    ${renderExportList("생각하기", thinkItems)}
    ${renderExportList("궁금해하기", wonderItems)}
  </section>`;
}

function renderCombinedResponseExportSection(response, index) {
  return `
  <section class="student">
    <div class="student-head">
      <span class="student-name">${index + 1}. ${escapeHtml(response.name)}</span>
      <span class="submitted-at">제출: ${escapeHtml(formatReadableDate(response.createdAt))}</span>
    </div>
    ${renderCombinedExportList(normalizeCombinedList(response.combined))}
  </section>`;
}

function renderExportList(label, values) {
  if (values.length === 0) {
    return `<h3>${label}</h3><p class="empty">미제출</p>`;
  }

  return `<h3>${label}</h3><ol>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ol>`;
}

function renderCombinedExportList(values) {
  if (values.length === 0) {
    return `<h3>한 번에 작성</h3><p class="empty">미제출</p>`;
  }

  return `<h3>한 번에 작성</h3>${values.map((value) => `
    <div class="combined-item">
      <div><strong>보기:</strong> ${escapeHtml(value.see)}</div>
      <div><strong>생각하기:</strong> ${escapeHtml(value.think)}</div>
      <div><strong>궁금해하기:</strong> ${escapeHtml(value.wonder)}</div>
    </div>
  `).join("")}`;
}

function countStepAnswers(step, submittedResponses = getSubmittedStudentResponses()) {
  return submittedResponses.reduce((sum, response) => sum + normalizeList(response[step]).filter(Boolean).length, 0);
}

function hasSequentialAnswers(response) {
  return ["see", "think", "wonder"].some((step) => normalizeList(response[step]).filter(Boolean).length > 0);
}

function formatFileDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function formatReadableDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
          <article class="postit-card ${card.cardClass} answer-${(index % answerAccentCount) + 1}" tabindex="0" role="button" data-student-name="${escapeAttribute(card.studentName)}" aria-label="${escapeAttribute(card.studentName)} 답변">
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

function renderSummaryAnswers(options = {}) {
  const { showDelete = true } = options;
  const cards = getCollectedSummaryAnswers();
  if (cards.length === 0) {
    return `<div class="teacher-step-empty">미제출</div>`;
  }

  return `
    <div class="teacher-postit-grid summary-postit-grid" aria-label="헤드라인 전체 답변">
      ${cards
        .map((card, index) => `
          <article class="postit-card ${card.cardClass} answer-${(index % answerAccentCount) + 1}" tabindex="0" role="button" data-student-name="${escapeAttribute(card.studentName)}" aria-label="${escapeAttribute(card.studentName)} 답변">
            ${showDelete ? `<button
              class="postit-delete-button"
              type="button"
              data-delete-answer
              data-response-id="${escapeAttribute(card.responseId)}"
              data-answer-step="summary"
              data-answer-index="${card.answerIndex}"
              aria-label="답변 지우기"
              title="지우기"
            >
              X
            </button>` : ""}
            <div class="postit-content"><p>${escapeHtml(card.value)}</p></div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function getCollectedCombinedAnswers() {
  return getSubmittedStudentResponses()
    .flatMap((response) =>
      normalizeCombinedList(response.combined).map((value, answerIndex) => ({
        responseId: response.id,
        studentName: response.name,
        answerIndex,
        value,
      }))
    );
}

function getCollectedSummaryAnswers() {
  return Array.from({ length: studentCount }, (_, index) => {
    const studentName = `${index + 1}번`;
    const value = getSummaryHeadline(studentName);
    return value ? {
      responseId: getSummaryResponseSettingId(studentName),
      studentName,
      answerIndex: 0,
      value,
      cardClass: getPostitLengthClass(value),
    } : null;
  }).filter(Boolean);
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
  return getSubmittedStudentResponses().flatMap((response) => buildCollectedStepCards(response, step));
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
    cardClass: getPostitLengthClass(value),
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

function getPostitLengthClass(value) {
  const length = String(value || "").replace(/\s/g, "").length;
  if (length >= 42) return "postit-text-long";
  if (length >= 30) return "postit-text-medium";
  return "";
}

function openTeacherStudentModal(studentName, step, selectedAnswerIndex = null) {
  const response = getResponseByStudentName(studentName);
  if (!response) return;

  savePresentationLockSetting(true).catch(() => {
    showToast("발표 집중 모드를 켜지 못했습니다.");
  });
  modalMode = "teacher";
  document.querySelector("#confirmModalTitle").textContent = studentName;
  elements.modalBackButton.hidden = true;
  elements.modalSubmitButton.textContent = "닫기";
  elements.confirmModal.classList.add("teacher-answer-modal");
  elements.confirmModal.classList.toggle("teacher-tools-locked", !teacherToolsUnlocked);
  elements.modalSentenceList.innerHTML = `
    <section class="teacher-response-set teacher-response-single">
      <button class="icon-delete-button" type="button" data-delete-response="${escapeAttribute(response.id)}" aria-label="학생 답변 비우기" title="비우기">
        삭제
      </button>
      <div class="teacher-modal-focus-layout">
        ${renderTeacherModalClassImage()}
        <div class="teacher-modal-answer">
          ${renderStepResponse(response, step, selectedAnswerIndex)}
        </div>
      </div>
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

  savePresentationLockSetting(true).catch(() => {
    showToast("발표 집중 모드를 켜지 못했습니다.");
  });
  modalMode = "teacher";
  document.querySelector("#confirmModalTitle").textContent = studentName;
  elements.modalBackButton.hidden = true;
  elements.modalSubmitButton.textContent = "닫기";
  elements.confirmModal.classList.add("teacher-answer-modal");
  elements.confirmModal.classList.toggle("teacher-tools-locked", !teacherToolsUnlocked);
  elements.modalSentenceList.innerHTML = `
    <section class="teacher-response-set teacher-response-single">
      <button class="icon-delete-button" type="button" data-delete-response="${escapeAttribute(response.id)}" aria-label="학생 답변 비우기" title="비우기">
        삭제
      </button>
      <div class="teacher-modal-focus-layout">
        ${renderTeacherModalClassImage()}
        <div class="teacher-modal-answer">
          ${renderCombinedValueCards(response.combined, selectedAnswerIndex)}
        </div>
      </div>
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

function openTeacherSummaryStudentModal(studentName, selectedAnswerIndex = null) {
  const headline = getSummaryHeadline(studentName);
  if (!headline) return;

  savePresentationLockSetting(true).catch(() => {
    showToast("발표 집중 모드를 켜지 못했습니다.");
  });
  modalMode = "teacher";
  document.querySelector("#confirmModalTitle").textContent = studentName;
  elements.modalBackButton.hidden = true;
  elements.modalSubmitButton.textContent = "닫기";
  elements.confirmModal.classList.add("teacher-answer-modal");
  elements.confirmModal.classList.toggle("teacher-tools-locked", !teacherToolsUnlocked);
  elements.modalSentenceList.innerHTML = `
    <section class="teacher-response-set teacher-response-single">
      <button class="icon-delete-button" type="button" data-delete-response="${escapeAttribute(getSummaryResponseSettingId(studentName))}" aria-label="학생 답변 비우기" title="비우기">
        삭제
      </button>
      <div class="teacher-modal-answer">
        ${renderValueCards([headline], "summary", (value) => `<p><span class="sentence-block summary-block">${escapeHtml(value)}</span></p>`, selectedAnswerIndex)}
      </div>
    </section>
  `;

  elements.modalSentenceList.querySelector("[data-delete-response]")?.addEventListener("click", async (event) => {
    if (!window.confirm(`${studentName}의 답변을 비울까요?`)) return;

    try {
      await deleteSummaryHeadline(studentName);
      await refreshSummaryResponses();
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

function renderTeacherModalClassImage() {
  if (!classImageDataUrl) return "";

  return `
    <figure class="teacher-modal-image">
      <img src="${escapeAttribute(classImageDataUrl)}" alt="수업 사진">
    </figure>
  `;
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
  const stepLabel = teacherSteps[step]?.label || "헤드라인";
  const emptyLabel = teacherSteps[step]?.empty || "미제출";
  const submittedValues = normalizeList(values)
    .map((value, index) => ({ value, index }))
    .filter((item) => item.value)
    .filter((item) => selectedAnswerIndex === null || item.index === selectedAnswerIndex);
  if (submittedValues.length === 0) {
    return `<div class="teacher-step-empty">${emptyLabel}</div>`;
  }

  return `
    <div class="teacher-sentence-list" aria-label="${stepLabel} 결과">
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

function getSubmittedStudentResponses() {
  return [...getStudentResponses()].sort((first, second) => {
    const firstTime = Date.parse(first.createdAt || "") || 0;
    const secondTime = Date.parse(second.createdAt || "") || 0;
    return firstTime - secondTime;
  });
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

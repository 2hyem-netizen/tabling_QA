const scopeOptions = ["PUBLIC", "PRIVATE"];

const elements = {
  officeApiUrl: document.getElementById("officeApiUrl"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  restaurantIdx: document.getElementById("restaurantIdx"),
  loadBtn: document.getElementById("loadBtn"),
  saveBtn: document.getElementById("saveBtn"),
  saveOptionBtn: document.getElementById("saveOptionBtn"),
  addressSearchBtn: document.getElementById("addressSearchBtn"),
  addressSearchLayer: document.getElementById("addressSearchLayer"),
  addressSearchFrame: document.getElementById("addressSearchFrame"),
  addressSearchCloseBtn: document.getElementById("addressSearchCloseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  status: document.getElementById("status"),
  responseBox: document.getElementById("responseBox"),
  heroRestaurant: document.getElementById("heroRestaurant"),
  heroName: document.getElementById("heroName"),
  heroAddress: document.getElementById("heroAddress"),
  name: document.getElementById("name"),
  categories: document.getElementById("categories"),
  address1: document.getElementById("address1"),
  address2: document.getElementById("address2"),
  addressDetail: document.getElementById("addressDetail"),
  summaryAddress: document.getElementById("summaryAddress"),
  zipCode: document.getElementById("zipCode"),
  tel: document.getElementById("tel"),
  foodOrigin: document.getElementById("foodOrigin"),
  kioskType: document.getElementById("kioskType"),
  waitingServiceScope: document.getElementById("waitingServiceScope"),
  orderServiceScope: document.getElementById("orderServiceScope"),
  nowReserveServiceScope: document.getElementById("nowReserveServiceScope"),
  isHidden: document.getElementById("isHidden"),
  isHold: document.getElementById("isHold"),
  latitude: document.getElementById("latitude"),
  longitude: document.getElementById("longitude"),
  multiNameEn: document.getElementById("multiNameEn"),
  multiAddress1En: document.getElementById("multiAddress1En"),
  rawJson: document.getElementById("rawJson"),
  optionTabs: document.querySelectorAll("[data-option-tab]"),
  optionReserveStatus: document.getElementById("optionReserveStatus"),
  optionWaitingStatus: document.getElementById("optionWaitingStatus"),
  optionTakeOutStatus: document.getElementById("optionTakeOutStatus"),
  optionFields: document.getElementById("optionFields")
};

let originalRestaurant = null;
let originalRestaurantOption = null;
let currentRestaurantOption = null;
let selectedOptionTab = "waiting";
let isBusy = false;
const OPTION_UPDATE_EXCLUDED_KEYS = new Set(["_id", "restaurantIdx"]);
const OPTION_UPDATE_EXCLUDED_PATHS = new Set([
  "reserve.useWeb",
  "reserve.blockAmount"
]);

function readConfigFromForm() {
  return {
    kioskApiUrl: getConfig().kioskApiUrl,
    officeApiUrl: elements.officeApiUrl.value.trim().replace(/\/+$/, ""),
    email: elements.email.value.trim(),
    password: elements.password.value,
    restaurantIdx: Number(elements.restaurantIdx.value)
  };
}

function persistConfig() {
  saveConfig(readConfigFromForm());
}

function fillScopeSelect(select, value) {
  select.innerHTML = "";
  scopeOptions.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    if (optionValue === value) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function populateForm(restaurant) {
  originalRestaurant = restaurant;
  elements.heroRestaurant.textContent = String(restaurant.idx ?? "-");
  elements.heroName.textContent = restaurant.name || "-";
  elements.heroAddress.textContent = [
    restaurant.address1,
    restaurant.addressDetail
  ].filter(Boolean).join(" ") || "-";

  elements.name.value = restaurant.name || "";
  elements.categories.value = restaurant.categories || "";
  elements.address1.value = restaurant.address1 || "";
  elements.address2.value = restaurant.address2 || "";
  elements.addressDetail.value = restaurant.addressDetail || "";
  elements.summaryAddress.value = restaurant.summaryAddress || "";
  elements.zipCode.value = restaurant.zipCode || "";
  elements.tel.value = formatPhone(restaurant.tels);
  elements.foodOrigin.value = restaurant.foodOrigin || "";
  elements.kioskType.value = restaurant.kioskType || "";
  fillScopeSelect(elements.waitingServiceScope, restaurant.waitingServiceScope || "PUBLIC");
  fillScopeSelect(elements.orderServiceScope, restaurant.orderServiceScope || "PUBLIC");
  fillScopeSelect(elements.nowReserveServiceScope, restaurant.nowReserveServiceScope || "PRIVATE");
  elements.isHidden.checked = Boolean(restaurant.isHidden);
  elements.isHold.checked = Boolean(restaurant.isHold);
  elements.latitude.value = restaurant.latitude ?? "";
  elements.longitude.value = restaurant.longitude ?? "";
  elements.multiNameEn.value = restaurant.multiLanguage?.name?.en || "";
  elements.multiAddress1En.value = restaurant.multiLanguage?.address1?.en || "";
  elements.rawJson.value = JSON.stringify(restaurant, null, 2);
}

function buildUpdatePayload() {
  const payload = {
    name: elements.name.value.trim(),
    categories: elements.categories.value.trim(),
    address1: elements.address1.value.trim(),
    address2: elements.address2.value.trim(),
    addressDetail: elements.addressDetail.value.trim(),
    summaryAddress: elements.summaryAddress.value.trim(),
    zipCode: elements.zipCode.value.trim(),
    isHidden: elements.isHidden.checked,
    isHold: elements.isHold.checked,
    latitude: Number(elements.latitude.value),
    longitude: Number(elements.longitude.value),
    tels: elements.tel.value.trim(),
    multiLanguage: {
      ...(originalRestaurant?.multiLanguage || {}),
      name: {
        ...(originalRestaurant?.multiLanguage?.name || {}),
        en: elements.multiNameEn.value.trim()
      },
      address1: {
        ...(originalRestaurant?.multiLanguage?.address1 || {}),
        en: elements.multiAddress1En.value.trim()
      }
    }
  };

  if (!Number.isFinite(payload.latitude)) {
    delete payload.latitude;
  }

  if (!Number.isFinite(payload.longitude)) {
    delete payload.longitude;
  }

  return payload;
}

function getPostcodeConstructor() {
  return window.kakao?.Postcode || window.daum?.Postcode || null;
}

function closeAddressSearchLayer() {
  elements.addressSearchLayer.hidden = true;
}

function applySelectedAddress(data) {
  const roadAddress = data.roadAddress || data.autoRoadAddress || (data.userSelectedType === "R" ? data.address : "");
  const jibunAddress = data.jibunAddress || data.autoJibunAddress || (data.userSelectedType === "J" ? data.address : "");

  elements.zipCode.value = data.zonecode || "";
  elements.address1.value = roadAddress;
  elements.address2.value = jibunAddress;

  const addressParts = [
    elements.address1.value,
    elements.addressDetail.value
  ].filter(Boolean);
  elements.summaryAddress.value = addressParts.join(" ");
  elements.heroAddress.textContent = addressParts.join(" ") || "-";
  setStatusElement(elements.status, "선택한 주소를 반영했습니다. 상세 주소를 확인해 주세요.", "success");
  elements.addressDetail.focus();
}

function handleAddressSearch() {
  const Postcode = getPostcodeConstructor();
  if (!Postcode) {
    setStatusElement(elements.status, "주소 검색 스크립트를 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.", "error");
    return;
  }

  elements.addressSearchLayer.hidden = false;

  new Postcode({
    oncomplete: function (data) {
      applySelectedAddress(data);
      closeAddressSearchLayer();
    },
    width: "100%",
    height: "100%"
  }).embed(elements.addressSearchFrame);
}

function setBusy(state) {
  isBusy = state;
  elements.loadBtn.disabled = state;
  elements.saveBtn.disabled = state;
  elements.saveOptionBtn.disabled = state;
  elements.addressSearchBtn.disabled = state;
  elements.resetBtn.disabled = state;
}

function renderResponse(title, detail, ok = true) {
  elements.responseBox.innerHTML = `
    <div class="log-item ${ok ? "success" : "error"}">
      <div class="log-head">
        <span>${timestamp()}</span>
        <span>${ok ? "SUCCESS" : "ERROR"}</span>
      </div>
      <div class="log-title">${title}</div>
      <pre>${detail}</pre>
    </div>
  `;
}

function loadCachedRestaurantIfAvailable() {
  const cache = getRestaurantCache();
  const config = readConfigFromForm();

  if (cache && Number(cache.restaurantIdx) === Number(config.restaurantIdx) && cache.data) {
    populateForm(cache.data);
    setStatusElement(elements.status, "상위 페이지에서 불러온 매장 정보를 표시하고 있습니다.", "neutral");
    return true;
  }

  return false;
}

function formatActivation(option) {
  if (!option) {
    return "-";
  }

  return option.isActivated ? "ON" : "OFF";
}

function formatWaitingActivation(option) {
  if (!option) {
    return "-";
  }

  return `공통 ${formatActivation(option.onSite)} / 대기 ${formatActivation(option.waiting)}`;
}

function cloneOptionValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function renderRestaurantOption(option) {
  originalRestaurantOption = cloneOptionValue(option);
  currentRestaurantOption = cloneOptionValue(option);
  updateOptionStatuses();
  renderSelectedOptionTab();
}

function updateOptionStatuses() {
  if (!currentRestaurantOption) {
    return;
  }

  const option = currentRestaurantOption;
  elements.optionReserveStatus.textContent = formatActivation(option.reserve);
  elements.optionWaitingStatus.textContent = formatWaitingActivation(option);
  elements.optionTakeOutStatus.textContent = formatActivation(option.takeOut);
}

function renderSelectedOptionTab() {
  elements.optionTabs.forEach((tab) => {
    const isSelected = tab.dataset.optionTab === selectedOptionTab;
    tab.classList.toggle("is-active", isSelected);
    tab.setAttribute("aria-selected", String(isSelected));
  });

  if (!currentRestaurantOption) {
    renderOptionEmpty("매장 정보를 불러오면 선택한 옵션 탭의 정보가 표시됩니다.");
    return;
  }

  if (selectedOptionTab === "waiting") {
    renderWaitingOptionFields();
    return;
  }

  const selectedOption = currentRestaurantOption[selectedOptionTab] || null;

  renderOptionFields(selectedOption);
}

function selectOptionTab(tabName) {
  selectedOptionTab = tabName;
  renderSelectedOptionTab();
}

function renderOptionEmpty(message) {
  elements.optionFields.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "option-empty";
  empty.textContent = message;
  elements.optionFields.appendChild(empty);
}

function formatFieldLabel(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function createOptionInput(value, type, path) {
  const input = document.createElement("input");
  input.type = type;
  input.value = value ?? "";
  const syncValue = (event) => {
    if (type === "number") {
      updateOptionValue(path, event.target.value === "" ? null : Number(event.target.value));
    } else {
      updateOptionValue(path, event.target.value);
    }
  };
  input.addEventListener("input", syncValue);
  input.addEventListener("change", syncValue);
  return input;
}

function resolveOptionPath(path) {
  if (selectedOptionTab !== "waiting") {
    return [selectedOptionTab, ...path];
  }

  const [rootKey, ...rest] = path;
  if (rootKey === "대기 공통") {
    return ["onSite", ...rest];
  }
  if (rootKey === "대기") {
    return ["waiting", ...rest];
  }

  return path;
}

function updateOptionValue(path, value) {
  if (!currentRestaurantOption) {
    return;
  }

  const actualPath = resolveOptionPath(path);
  const leafKey = actualPath[actualPath.length - 1];
  const parent = actualPath.slice(0, -1).reduce((target, key) => {
    if (!target || typeof target !== "object") {
      return null;
    }

    if (target[key] == null) {
      target[key] = {};
    }

    return target[key];
  }, currentRestaurantOption);

  if (!parent || leafKey === undefined) {
    return;
  }

  parent[leafKey] = value;
  updateOptionStatuses();
}

function isOptionUpdateExcluded(path) {
  const key = path[path.length - 1];
  return OPTION_UPDATE_EXCLUDED_KEYS.has(key) || OPTION_UPDATE_EXCLUDED_PATHS.has(path.join("."));
}

function areOptionValuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sanitizeOptionUpdateValue(value, path = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeOptionUpdateValue(item, [...path, String(index)]));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((payload, [key, childValue]) => {
      const childPath = [...path, key];
      if (!isOptionUpdateExcluded(childPath)) {
        payload[key] = sanitizeOptionUpdateValue(childValue, childPath);
      }
      return payload;
    }, {});
  }

  return value;
}

function buildOptionUpdatePayload(originalValue, currentValue, path = []) {
  if (isOptionUpdateExcluded(path)) {
    return undefined;
  }

  if (Array.isArray(currentValue)) {
    const originalArray = Array.isArray(originalValue) ? originalValue : [];
    const sanitizedOriginal = sanitizeOptionUpdateValue(originalArray, path);
    const sanitizedCurrent = sanitizeOptionUpdateValue(currentValue, path);
    return areOptionValuesEqual(sanitizedOriginal, sanitizedCurrent) ? undefined : sanitizedCurrent;
  }

  if (currentValue && typeof currentValue === "object") {
    const originalObject = originalValue && typeof originalValue === "object" && !Array.isArray(originalValue)
      ? originalValue
      : {};
    const keys = new Set([
      ...Object.keys(originalObject),
      ...Object.keys(currentValue)
    ]);

    const payload = {};
    keys.forEach((key) => {
      const childPath = [...path, key];
      if (isOptionUpdateExcluded(childPath)) {
        return;
      }

      const childPayload = buildOptionUpdatePayload(originalObject[key], currentValue[key], childPath);
      if (childPayload !== undefined) {
        payload[key] = childPayload;
      }
    });

    return Object.keys(payload).length ? payload : undefined;
  }

  return areOptionValuesEqual(originalValue, currentValue) ? undefined : currentValue;
}

function buildChangedOptionPayload() {
  return buildOptionUpdatePayload(originalRestaurantOption, currentRestaurantOption) || {};
}

function hasPayloadChanges(payload) {
  return Boolean(payload && Object.keys(payload).length);
}

function getOptionValue(path) {
  return path.reduce((target, key) => target?.[key], currentRestaurantOption);
}

function createBooleanToggle(value, path, options = {}) {
  const wrap = document.createElement("label");
  wrap.className = "toggle";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.addEventListener("change", (event) => {
    updateOptionValue(path, event.target.checked);
    if (options.refreshOnChange) {
      renderSelectedOptionTab();
    }
  });

  const slider = document.createElement("span");
  slider.className = "toggle-slider";

  wrap.append(input, slider);
  return wrap;
}

function createConfiguredOptionField({ label, path, type = "boolean", refreshOnChange = false }) {
  const value = getOptionValue(path);
  const field = document.createElement("div");
  field.className = "option-field";

  const labelElement = document.createElement("label");
  labelElement.textContent = label;
  field.appendChild(labelElement);

  if (type === "boolean") {
    field.appendChild(createBooleanToggle(value, path, { refreshOnChange }));
  } else {
    field.appendChild(createOptionInput(value, type, path));
  }

  return field;
}

function createWaitingOptionSection(title, fields) {
  const section = document.createElement("details");
  section.className = "option-section";
  section.open = true;

  const summary = document.createElement("summary");
  summary.textContent = title;
  section.appendChild(summary);

  const grid = document.createElement("div");
  grid.className = "option-field-grid";
  fields.forEach((field) => {
    grid.appendChild(createConfiguredOptionField(field));
  });
  section.appendChild(grid);
  return section;
}

function renderWaitingOptionFields() {
  elements.optionFields.innerHTML = "";

  if (!currentRestaurantOption?.waiting) {
    renderOptionEmpty("대기 옵션 정보가 없습니다.");
    return;
  }

  const commonFields = [
    {
      label: "호출 후 미입장 시 자동 취소",
      path: ["waiting", "useEntryCancel"]
    },
    {
      label: "방문의사 확인 여부",
      path: ["waiting", "useVisitDecision"],
      refreshOnChange: true
    }
  ];

  const useVisitDecision = getOptionValue(["waiting", "useVisitDecision"]);
  if (useVisitDecision) {
    commonFields.push({
      label: "방문의사 미응답 자동 취소",
      path: ["waiting", "useVisitDecisionCancel"],
      refreshOnChange: true
    });

    if (getOptionValue(["waiting", "useVisitDecisionCancel"])) {
      commonFields.push({
        label: "응답 만료 시간(분)",
        path: ["waiting", "visitDecisionCancelMinutes"],
        type: "number"
      });
    }
  }

  const remoteFields = [
    {
      label: "대기확정코드 도착 인증",
      path: ["waiting", "useWaitingConfirmCode"]
    },
    {
      label: "위치 도착 인증",
      path: ["waiting", "useLocationCheckIn"],
      refreshOnChange: true
    }
  ];

  if (getOptionValue(["waiting", "useLocationCheckIn"])) {
    remoteFields.push({
      label: "도착 인증 반경(m)",
      path: ["waiting", "checkInRadiusMeters"],
      type: "number"
    });
  }

  remoteFields.push(
    {
      label: "보증금 설정",
      path: ["waiting", "pay", "isActivated"]
    },
    {
      label: "거리 제한 설정",
      path: ["waiting", "restrictedDistance", "isActivated"],
      refreshOnChange: true
    }
  );

  if (getOptionValue(["waiting", "restrictedDistance", "isActivated"])) {
    remoteFields.push({
      label: "거리",
      path: ["waiting", "restrictedDistance", "distance"],
      type: "number"
    });
  }

  elements.optionFields.append(
    createWaitingOptionSection("대기 공통 항목", commonFields),
    createWaitingOptionSection("원격 줄서기 설정 항목", remoteFields)
  );
}

function createPrimitiveField(key, value, path) {
  const field = document.createElement("div");
  field.className = "option-field";

  const label = document.createElement("label");
  label.textContent = formatFieldLabel(key);
  field.appendChild(label);

  if (typeof value === "boolean") {
    field.appendChild(createBooleanToggle(value, path));
  } else if (typeof value === "number") {
    field.appendChild(createOptionInput(value, "number", path));
  } else if (typeof value === "string") {
    field.appendChild(createOptionInput(value, "text", path));
  } else if (value === null) {
    field.appendChild(createOptionInput("", "text", path));
  } else {
    field.appendChild(createOptionInput(String(value), "text", path));
  }

  return field;
}

function renderOptionValue(key, value, path, depth = 0) {
  if (Array.isArray(value)) {
    const section = document.createElement("details");
    section.className = "option-section";
    section.open = depth < 1;

    const summary = document.createElement("summary");
    summary.textContent = `${formatFieldLabel(key)} [${value.length}]`;
    section.appendChild(summary);

    const list = document.createElement("div");
    list.className = "option-field-grid";
    value.forEach((item, index) => {
      const childKey = String(index);
      list.appendChild(renderOptionValue(childKey, item, [...path, childKey], depth + 1));
    });
    section.appendChild(list);
    return section;
  }

  if (value && typeof value === "object") {
    const section = document.createElement("details");
    section.className = "option-section";
    section.open = depth < 2;

    const summary = document.createElement("summary");
    summary.textContent = formatFieldLabel(key);
    section.appendChild(summary);

    const grid = document.createElement("div");
    grid.className = "option-field-grid";
    Object.entries(value).forEach(([childKey, childValue]) => {
      grid.appendChild(renderOptionValue(childKey, childValue, [...path, childKey], depth + 1));
    });
    section.appendChild(grid);
    return section;
  }

  return createPrimitiveField(key, value, path);
}

function renderOptionFields(option) {
  elements.optionFields.innerHTML = "";

  if (!option) {
    renderOptionEmpty("선택한 옵션 정보가 없습니다.");
    return;
  }

  Object.entries(option).forEach(([key, value]) => {
    elements.optionFields.appendChild(renderOptionValue(key, value, [key]));
  });
}

function summarizeRestaurant(restaurant) {
  if (!restaurant) {
    return null;
  }

  return {
    idx: restaurant.idx,
    name: restaurant.name,
    address1: restaurant.address1,
    waitingServiceScope: restaurant.waitingServiceScope
  };
}

function summarizeRestaurantOption(option) {
  return {
    restaurantIdx: option.restaurantIdx,
    "대기": {
      "공통": option.onSite?.isActivated,
      "대기": option.waiting?.isActivated
    },
    "예약": option.reserve?.isActivated,
    "포장": option.takeOut?.isActivated
  };
}

async function loadRestaurantOption(config, token) {
  const option = await fetchRestaurantOption(config, token);
  renderRestaurantOption(option);
  return option;
}

async function handleLoad(forceRefresh = false) {
  const config = readConfigFromForm();
  persistConfig();
  setBusy(true);
  setStatusElement(elements.status, "매장 정보와 옵션 정보를 불러오는 중입니다...");

  try {
    const isUsingCache = !forceRefresh && loadCachedRestaurantIfAvailable();
    const token = await ensureAccessToken(config);

    let restaurant = originalRestaurant;
    if (!isUsingCache) {
      restaurant = await fetchRestaurant(config, token);
      populateForm(restaurant);
    }

    try {
      const option = await loadRestaurantOption(config, token);
      setStatusElement(elements.status, "매장 정보와 옵션 정보를 불러왔습니다.", "success");
      renderResponse("매장/옵션 조회 성공", JSON.stringify({
        restaurant: summarizeRestaurant(restaurant),
        option: summarizeRestaurantOption(option)
      }, null, 2));
    } catch (optionError) {
      setStatusElement(elements.status, "매장 정보는 불러왔지만 옵션 정보 조회에 실패했습니다.", "error");
      renderResponse("매장 옵션 조회 실패", String(optionError), false);
    }
  } catch (error) {
    setStatusElement(elements.status, "매장 정보 또는 옵션 정보 조회에 실패했습니다.", "error");
    renderResponse("매장/옵션 조회 실패", String(error), false);
  } finally {
    setBusy(false);
  }
}

async function handleSave() {
  if (!originalRestaurant) {
    setStatusElement(elements.status, "먼저 매장 정보를 불러와 주세요.", "error");
    return;
  }

  const config = readConfigFromForm();
  persistConfig();
  setBusy(true);
  setStatusElement(elements.status, "변경된 매장 정보를 저장하는 중입니다...");

  try {
    const token = await ensureAccessToken(config);
    const payload = buildUpdatePayload();
    const result = await updateRestaurant(config, payload, token);

    if (result.data) {
      populateForm(result.data);
    } else {
      const refreshed = await fetchRestaurant(config, token);
      populateForm(refreshed);
    }

    setStatusElement(elements.status, "매장 정보 저장에 성공했습니다.", "success");
    renderResponse("매장 수정 성공", JSON.stringify({
      endpoint: result.url,
      request: payload,
      status: result.status,
      response: result.data
    }, null, 2));
  } catch (error) {
    setStatusElement(elements.status, "매장 정보 저장에 실패했습니다.", "error");
    renderResponse("매장 수정 실패", String(error), false);
  } finally {
    setBusy(false);
  }
}

async function handleSaveOption() {
  if (!currentRestaurantOption) {
    setStatusElement(elements.status, "먼저 매장 정보와 옵션 정보를 불러와 주세요.", "error");
    return;
  }

  const config = readConfigFromForm();
  persistConfig();
  setBusy(true);
  setStatusElement(elements.status, "매장 옵션 정보를 저장하는 중입니다...");

  try {
    const token = await ensureAccessToken(config);
    const payload = buildChangedOptionPayload();
    if (!hasPayloadChanges(payload)) {
      setStatusElement(elements.status, "변경된 매장 옵션 정보가 없습니다.", "neutral");
      renderResponse("매장 옵션 저장 생략", JSON.stringify({
        endpoint: `${config.officeApiUrl.replace(/\/+$/, "")}/v2/restaurant-options?restaurantIdx=${config.restaurantIdx}`,
        request: payload
      }, null, 2));
      return;
    }

    const result = await updateRestaurantOption(config, payload, token);
    const option = await fetchRestaurantOption(config, token);
    renderRestaurantOption(option);

    setStatusElement(elements.status, "매장 옵션 정보 저장에 성공했습니다.", "success");
    renderResponse("매장 옵션 저장 성공", JSON.stringify({
      endpoint: result.url,
      request: payload,
      status: result.status,
      response: result.data
    }, null, 2));
  } catch (error) {
    setStatusElement(elements.status, "매장 옵션 정보 저장에 실패했습니다.", "error");
    renderResponse("매장 옵션 저장 실패", String(error), false);
  } finally {
    setBusy(false);
  }
}

function handleReset() {
  if (!originalRestaurant) {
    return;
  }

  populateForm(originalRestaurant);
  setStatusElement(elements.status, "불러온 원본 값으로 되돌렸습니다.", "neutral");
}

function initFormFromConfig() {
  const config = getConfig();
  const params = new URLSearchParams(window.location.search);
  const restaurantIdxFromUrl = params.get("restaurantIdx");

  elements.officeApiUrl.value = config.officeApiUrl;
  elements.email.value = config.email;
  elements.password.value = config.password;
  elements.restaurantIdx.value = restaurantIdxFromUrl || String(config.restaurantIdx);
  scopeOptions.forEach((optionValue) => {
    [elements.waitingServiceScope, elements.orderServiceScope, elements.nowReserveServiceScope].forEach((select) => {
      if (!select.options.length) {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        select.appendChild(option);
      }
    });
  });
}

loadToken();
initFormFromConfig();

[
  elements.officeApiUrl,
  elements.email,
  elements.password,
  elements.restaurantIdx
].forEach((element) => {
  element.addEventListener("change", persistConfig);
});

elements.loadBtn.addEventListener("click", () => handleLoad(true));
elements.saveBtn.addEventListener("click", handleSave);
elements.saveOptionBtn.addEventListener("click", handleSaveOption);
elements.addressSearchBtn.addEventListener("click", handleAddressSearch);
elements.addressSearchCloseBtn.addEventListener("click", closeAddressSearchLayer);
elements.resetBtn.addEventListener("click", handleReset);
elements.optionTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    selectOptionTab(tab.dataset.optionTab);
  });
});

const params = new URLSearchParams(window.location.search);
renderSelectedOptionTab();
if (params.get("load") === "1" || getRestaurantCache()) {
  handleLoad(false);
} else {
  setStatusElement(elements.status, "매장 정보를 불러와 주세요.", "neutral");
}

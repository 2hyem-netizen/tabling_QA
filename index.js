const elements = {
  kioskApiUrl: document.getElementById("kioskApiUrl"),
  officeApiUrl: document.getElementById("officeApiUrl"),
  kioskEmail: document.getElementById("kioskEmail"),
  kioskPassword: document.getElementById("kioskPassword"),
  officeEmail: document.getElementById("officeEmail"),
  officePassword: document.getElementById("officePassword"),
  restaurantIdx: document.getElementById("restaurantIdx"),
  loadBtn: document.getElementById("loadBtn"),
  kioskLoginBtn: document.getElementById("kioskLoginBtn"),
  officeLoginBtn: document.getElementById("officeLoginBtn"),
  status: document.getElementById("status"),
  heroRestaurant: document.getElementById("heroRestaurant"),
  heroName: document.getElementById("heroName"),
  heroAddress: document.getElementById("heroAddress"),
  heroPhone: document.getElementById("heroPhone"),
  heroWaitingScope: document.getElementById("heroWaitingScope"),
  editLink: document.getElementById("editLink"),
  waitingLink: document.getElementById("waitingLink"),
  summaryCard: document.getElementById("summaryCard")
};

function readConfigFromForm() {
  return {
    kioskApiUrl: DEFAULT_KIOSK_API_URL,
    officeApiUrl: DEFAULT_OFFICE_API_URL,
    kioskEmail: elements.kioskEmail.value.trim(),
    kioskPassword: elements.kioskPassword.value,
    officeEmail: elements.officeEmail.value.trim(),
    officePassword: elements.officePassword.value,
    email: elements.officeEmail.value.trim(),
    password: elements.officePassword.value,
    restaurantIdx: Number(elements.restaurantIdx.value)
  };
}

function persistConfig() {
  saveConfig(readConfigFromForm());
  updateLinks();
}

function updateLinks() {
  const config = readConfigFromForm();
  elements.heroRestaurant.textContent = String(config.restaurantIdx || "-");
  elements.editLink.href = `restaurant_edit.html?load=1&restaurantIdx=${config.restaurantIdx}`;
  elements.waitingLink.href = "waiting_automation.html";
}

function renderSummary(restaurant) {
  elements.summaryCard.hidden = false;
  elements.heroName.textContent = restaurant.name || "-";
  elements.heroAddress.textContent = [
    restaurant.address1,
    restaurant.addressDetail
  ].filter(Boolean).join(" ") || "-";
  elements.heroPhone.textContent = formatPhone(restaurant.tels);
  elements.heroWaitingScope.textContent = restaurant.waitingServiceScope || "-";
}

function setBusy(state) {
  elements.loadBtn.disabled = state;
  elements.kioskLoginBtn.disabled = state;
  elements.officeLoginBtn.disabled = state;
}

async function handleKioskLogin() {
  const config = readConfigFromForm();
  persistConfig();
  setBusy(true);
  setStatusElement(elements.status, "Kiosk 로그인 요청을 보내는 중입니다...");

  try {
    saveKioskToken("");
    const data = await login(config.kioskApiUrl || DEFAULT_KIOSK_API_URL, config.kioskEmail, config.kioskPassword, KIOSK_LOGIN_ENDPOINT);
    saveKioskToken(data.accessToken);
    setStatusElement(elements.status, "Kiosk 로그인에 성공했습니다.", "success");
  } catch (error) {
    saveKioskToken("");
    setStatusElement(elements.status, `Kiosk 로그인에 실패했습니다: ${String(error)}`, "error");
  } finally {
    setBusy(false);
  }
}

async function handleOfficeLogin() {
  const config = readConfigFromForm();
  persistConfig();
  setBusy(true);
  setStatusElement(elements.status, "Office 로그인 요청을 보내는 중입니다...");

  try {
    saveToken("");
    const data = await login(config.officeApiUrl || DEFAULT_OFFICE_API_URL, config.officeEmail, config.officePassword, OFFICE_LOGIN_ENDPOINT);
    saveToken(data.accessToken);
    setStatusElement(elements.status, "Office 로그인에 성공했습니다.", "success");
  } catch (error) {
    saveToken("");
    setStatusElement(elements.status, `Office 로그인에 실패했습니다: ${String(error)}`, "error");
  } finally {
    setBusy(false);
  }
}

async function handleLoad() {
  const config = readConfigFromForm();
  persistConfig();
  setBusy(true);
  setStatusElement(elements.status, "매장 정보를 불러오는 중입니다...");

  try {
    const token = await ensureAccessToken(config, config.officeApiUrl || DEFAULT_OFFICE_API_URL);
    const restaurant = await fetchRestaurant(config, token);
    renderSummary(restaurant);
    setStatusElement(elements.status, "매장 정보를 불러왔습니다. 수정 페이지로 이동할 수 있습니다.", "success");
  } catch (error) {
    elements.summaryCard.hidden = true;
    setStatusElement(elements.status, `매장 정보 조회 실패: ${String(error)}`, "error");
  } finally {
    setBusy(false);
  }
}

function initFormFromConfig() {
  const config = getConfig();
  elements.kioskApiUrl.value = DEFAULT_KIOSK_API_URL;
  elements.officeApiUrl.value = DEFAULT_OFFICE_API_URL;
  elements.kioskEmail.value = config.kioskEmail;
  elements.kioskPassword.value = config.kioskPassword;
  elements.officeEmail.value = config.officeEmail;
  elements.officePassword.value = config.officePassword;
  elements.restaurantIdx.value = String(config.restaurantIdx);
}

loadToken();
loadKioskToken();
initFormFromConfig();
updateLinks();

[
  elements.kioskEmail,
  elements.kioskPassword,
  elements.officeEmail,
  elements.officePassword,
  elements.restaurantIdx
].forEach((element) => {
  element.addEventListener("input", updateLinks);
  element.addEventListener("change", persistConfig);
});

elements.kioskLoginBtn.addEventListener("click", handleKioskLogin);
elements.officeLoginBtn.addEventListener("click", handleOfficeLogin);
elements.loadBtn.addEventListener("click", handleLoad);

const cache = getRestaurantCache();
const config = getConfig();
if (cache && Number(cache.restaurantIdx) === Number(config.restaurantIdx) && cache.data) {
  renderSummary(cache.data);
  setStatusElement(elements.status, "저장된 매장 정보가 있습니다. 새로고침하려면 다시 불러오기를 눌러 주세요.", "neutral");
} else {
  setStatusElement(elements.status, "공통 설정을 입력한 뒤 매장 정보를 불러와 주세요.", "neutral");
}

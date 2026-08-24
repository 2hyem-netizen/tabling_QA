const elements = {
  kioskApiUrl: document.getElementById("kioskApiUrl"),
  officeApiUrl: document.getElementById("officeApiUrl"),
  kioskEmail: document.getElementById("kioskEmail"),
  kioskPassword: document.getElementById("kioskPassword"),
  officeEmail: document.getElementById("officeEmail"),
  officePassword: document.getElementById("officePassword"),
  kioskLoginBtn: document.getElementById("kioskLoginBtn"),
  officeLoginBtn: document.getElementById("officeLoginBtn"),
  status: document.getElementById("status")
};

function readConfigFromForm() {
  const storedConfig = getConfig();
  return {
    kioskApiUrl: DEFAULT_KIOSK_API_URL,
    officeApiUrl: DEFAULT_OFFICE_API_URL,
    kioskEmail: elements.kioskEmail.value.trim(),
    kioskPassword: elements.kioskPassword.value,
    officeEmail: elements.officeEmail.value.trim(),
    officePassword: elements.officePassword.value,
    email: elements.officeEmail.value.trim(),
    password: elements.officePassword.value,
    restaurantIdx: Number(storedConfig.restaurantIdx)
  };
}

function persistConfig() {
  saveConfig(readConfigFromForm());
}

function setBusy(state) {
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

function initFormFromConfig() {
  const config = getConfig();
  elements.kioskApiUrl.value = DEFAULT_KIOSK_API_URL;
  elements.officeApiUrl.value = DEFAULT_OFFICE_API_URL;
  elements.kioskEmail.value = config.kioskEmail;
  elements.kioskPassword.value = config.kioskPassword;
  elements.officeEmail.value = config.officeEmail;
  elements.officePassword.value = config.officePassword;
}

loadToken();
loadKioskToken();
initFormFromConfig();

[
  elements.kioskEmail,
  elements.kioskPassword,
  elements.officeEmail,
  elements.officePassword
].forEach((element) => {
  element.addEventListener("change", persistConfig);
});

elements.kioskLoginBtn.addEventListener("click", handleKioskLogin);
elements.officeLoginBtn.addEventListener("click", handleOfficeLogin);
setStatusElement(elements.status, "Kiosk 또는 Office 로그인을 실행할 수 있습니다.", "neutral");

const DEFAULT_KIOSK_API_URL = "https://staging-kiosk-api.tabling.co.kr";
const DEFAULT_OFFICE_API_URL = "https://staging-office-api.tabling.co.kr";
const KIOSK_LOGIN_ENDPOINT = "/v1/login";
const OFFICE_LOGIN_ENDPOINT = "/v1/auth/login";
const OFFICE_RESTAURANT_CHECK_ENDPOINT = "/v1/restaurants";
const OFFICE_RESTAURANT_CHANGE_ENDPOINT = "/v2/restaurants";
const OFFICE_RESTAURANT_OPTION_ENDPOINT = "/v1/restaurant-options";
const OFFICE_RESTAURANT_OPTION_CHANGE_ENDPOINT = "/v2/restaurant-options";
const CONFIG_STORAGE_KEY = "tabling-automation-config-v1";
const TOKEN_STORAGE_KEY = "tabling-office-access-token-v1";
const KIOSK_TOKEN_STORAGE_KEY = "tabling-kiosk-access-token-v1";
const RESTAURANT_CACHE_KEY = "tabling-automation-restaurant-cache-v1";

let accessToken = "";
let kioskAccessToken = "";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

function getConfig() {
  const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
  const defaults = {
    kioskApiUrl: DEFAULT_KIOSK_API_URL,
    officeApiUrl: DEFAULT_OFFICE_API_URL,
    email: "hmlee@tabling.co.kr",
    password: "tkfkdgo0!@34",
    kioskEmail: "hmlee@tabling.co.kr",
    kioskPassword: "tkfkdgo0!@34",
    officeEmail: "hmlee@tabling.co.kr",
    officePassword: "tkfkdgo0!@34",
    restaurantIdx: 52218
  };
  let savedConfig = {};

  if (raw) {
    try {
      savedConfig = JSON.parse(raw);
    } catch {
      savedConfig = {};
    }
  }

  const config = { ...defaults, ...savedConfig };
  if (!Object.prototype.hasOwnProperty.call(savedConfig, "officeEmail") && savedConfig.email !== undefined) {
    config.officeEmail = savedConfig.email;
  }
  if (!Object.prototype.hasOwnProperty.call(savedConfig, "officePassword") && savedConfig.password !== undefined) {
    config.officePassword = savedConfig.password;
  }
  if (!Object.prototype.hasOwnProperty.call(savedConfig, "kioskEmail") && savedConfig.email !== undefined) {
    config.kioskEmail = savedConfig.email;
  }
  if (!Object.prototype.hasOwnProperty.call(savedConfig, "kioskPassword") && savedConfig.password !== undefined) {
    config.kioskPassword = savedConfig.password;
  }

  config.email = config.officeEmail;
  config.password = config.officePassword;
  return config;
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function loadToken() {
  accessToken = localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  return accessToken;
}

function saveToken(token) {
  accessToken = token || "";
  if (accessToken) {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  return accessToken;
}

function loadKioskToken() {
  kioskAccessToken = localStorage.getItem(KIOSK_TOKEN_STORAGE_KEY) || "";
  return kioskAccessToken;
}

function saveKioskToken(token) {
  kioskAccessToken = token || "";
  if (kioskAccessToken) {
    localStorage.setItem(KIOSK_TOKEN_STORAGE_KEY, kioskAccessToken);
  } else {
    localStorage.removeItem(KIOSK_TOKEN_STORAGE_KEY);
  }
  return kioskAccessToken;
}

function getRestaurantCache() {
  const raw = localStorage.getItem(RESTAURANT_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveRestaurantCache(restaurantIdx, data) {
  localStorage.setItem(RESTAURANT_CACHE_KEY, JSON.stringify({
    restaurantIdx,
    fetchedAt: new Date().toISOString(),
    data
  }));
}

function timestamp() {
  return new Date().toLocaleString("ko-KR", { hour12: false });
}

async function login(apiUrl, email, password, endpoint = OFFICE_LOGIN_ENDPOINT) {
  const response = await fetch(`${apiUrl.replace(/\/+$/, "")}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
  }

  return data;
}

async function ensureAccessToken(config, apiUrl = config.officeApiUrl) {
  if (accessToken) {
    return accessToken;
  }

  const loginData = await login(apiUrl, config.email, config.password);
  saveToken(loginData.accessToken);
  return loginData.accessToken;
}

async function fetchRestaurant(config, token = accessToken) {
  const response = await fetch(
    `${config.officeApiUrl.replace(/\/+$/, "")}${OFFICE_RESTAURANT_CHECK_ENDPOINT}/${config.restaurantIdx}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    }
  );

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
  }

  saveRestaurantCache(config.restaurantIdx, data);
  return data;
}

async function updateRestaurant(config, payload, token = accessToken) {
  const url = `${config.officeApiUrl.replace(/\/+$/, "")}${OFFICE_RESTAURANT_CHANGE_ENDPOINT}/${config.restaurantIdx}`;
  const response = await fetch(
    url,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }
  );

  const data = response.status === 204 ? null : await parseResponse(response);

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
  }

  if (data) {
    saveRestaurantCache(config.restaurantIdx, data);
  }

  return {
    ok: response.ok,
    status: response.status,
    url,
    data
  };
}

async function fetchRestaurantOption(config, token = accessToken) {
  const url = new URL(`${config.officeApiUrl.replace(/\/+$/, "")}${OFFICE_RESTAURANT_OPTION_ENDPOINT}`);
  url.searchParams.set("restaurantIdx", String(config.restaurantIdx));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    }
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
  }

  return data;
}

async function updateRestaurantOption(config, payload, token = accessToken) {
  const url = new URL(`${config.officeApiUrl.replace(/\/+$/, "")}${OFFICE_RESTAURANT_OPTION_CHANGE_ENDPOINT}`);
  url.searchParams.set("restaurantIdx", String(config.restaurantIdx));

  const response = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = response.status === 204 ? null : await parseResponse(response);

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
  }

  return {
    ok: response.ok,
    status: response.status,
    url: url.toString(),
    data
  };
}

function formatPhone(tels) {
  if (typeof tels === "string") {
    return tels || "-";
  }

  if (!Array.isArray(tels) || !tels.length) {
    return "-";
  }

  const basic = tels.find((item) => item.type === "basic") || tels[0];
  return basic.tel || "-";
}

function setStatusElement(element, message, tone = "neutral") {
  element.textContent = message;
  element.className = "status";
  if (tone === "error") {
    element.classList.add("is-error");
  } else if (tone === "neutral") {
    element.classList.add("is-neutral");
  }
}

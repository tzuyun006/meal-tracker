(() => {
  "use strict";

  const MEAL_TYPES = [
    { id: "breakfast", label: "早餐", emoji: "☀️", defaultTime: "08:00" },
    { id: "lunch", label: "午餐", emoji: "🌤", defaultTime: "12:00" },
    { id: "dinner", label: "晚餐", emoji: "🌙", defaultTime: "18:00" }
  ];
  const DB_NAME = "meal-tracker-db";
  const DB_VERSION = 1;
  const STORE = "photos";
  const RECORDS_KEY = "mealTrackerRecordsV1";
  const SETTINGS_KEY = "mealTrackerSettingsV1";
  let db;
  let currentPhotoBlob = null;
  let currentPhotoId = null;
  let toastTimer;

  const $ = (id) => document.getElementById(id);
  const todayKey = () => localDateKey(new Date());
  const localDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const readRecords = () => {
    try { return JSON.parse(localStorage.getItem(RECORDS_KEY) || "{}"); }
    catch { return {}; }
  };
  const writeRecords = (data) => localStorage.setItem(RECORDS_KEY, JSON.stringify(data));
  const readSettings = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return {
        times: { breakfast: "08:00", lunch: "12:00", dinner: "18:00", ...(saved.times || {}) },
        notifications: Boolean(saved.notifications)
      };
    } catch {
      return { times: { breakfast: "08:00", lunch: "12:00", dinner: "18:00" }, notifications: false };
    }
  };
  const writeSettings = (settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("zh-TW");
  const openDB = () => new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("這個瀏覽器不支援照片本機儲存。"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const savePhoto = (id, blob) => new Promise((resolve, reject) => {
    if (!blob) return resolve();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  const getPhoto = (id) => new Promise((resolve, reject) => {
    if (!id) return resolve(null);
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  const deletePhoto = (id) => new Promise((resolve) => {
    if (!id || !db) return resolve();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  const showToast = (message) => {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  };
  const openDialog = (id) => $(id).showModal();
  const closeDialog = (id) => $(id).close();

  function getMeal(date, type) {
    return readRecords()[date]?.[type] || null;
  }
  function updateMeal(date, type, meal) {
    const records = readRecords();
    if (!records[date]) records[date] = {};
    records[date][type] = meal;
    writeRecords(records);
  }

  async function renderMeals() {
    const records = readRecords();
    const day = records[todayKey()] || {};
    const list = $("mealList");
    list.innerHTML = "";
    for (const type of MEAL_TYPES) {
      const meal = day[type.id];
      const card = document.createElement("article");
      card.className = "meal-card";
      const thumb = document.createElement("div");
      thumb.className = "meal-thumb";
      thumb.textContent = type.emoji;
      if (meal?.photoId) {
        try {
          const blob = await getPhoto(meal.photoId);
          if (blob) {
            const img = document.createElement("img");
            img.src = URL.createObjectURL(blob);
            img.alt = `${type.label}照片`;
            thumb.textContent = "";
            thumb.appendChild(img);
          }
        } catch (e) { console.warn("讀取照片失敗", e); }
      }
      const info = document.createElement("div");
      info.className = "meal-info";
      const titleRow = document.createElement("div");
      titleRow.className = "meal-title-row";
      const title = document.createElement("span");
      title.className = "meal-title";
      title.textContent = type.label;
      const status = document.createElement("span");
      status.className = "meal-status" + (meal ? " done" : "");
      status.textContent = meal ? "已記錄" : "尚未記錄";
      titleRow.append(title, status);
      const desc = document.createElement("p");
      desc.className = "meal-description";
      desc.textContent = meal ? (meal.name || "未填寫餐點名稱") : "今天還沒有留下紀錄";
      const time = document.createElement("span");
      time.className = "meal-time";
      time.textContent = meal?.time ? `用餐時間 ${meal.time}` : `建議時間 ${readSettings().times[type.id]}`;
      info.append(titleRow, desc, time);

      const side = document.createElement("div");
      side.className = "meal-side";
      const price = document.createElement("strong");
      price.className = "meal-price";
      price.textContent = meal ? money(meal.price) : "—";
      const actions = document.createElement("div");
      actions.className = "meal-actions";
      const edit = document.createElement("button");
      edit.className = "small-action";
      edit.textContent = meal ? "編輯" : "＋ 記錄";
      edit.addEventListener("click", () => openMealEditor(type.id));
      actions.append(edit);
      if (meal) {
        const remove = document.createElement("button");
        remove.className = "small-action";
        remove.textContent = "刪除";
        remove.addEventListener("click", async () => {
          if (!confirm(`確定刪除今天的${type.label}紀錄嗎？`)) return;
          const all = readRecords();
          const old = all[todayKey()]?.[type.id];
          if (old?.photoId) await deletePhoto(old.photoId);
          delete all[todayKey()][type.id];
          writeRecords(all);
          await renderAll();
          showToast("已刪除餐點紀錄");
        });
        actions.append(remove);
      }
      side.append(price, actions);
      card.append(thumb, info, side);
      list.append(card);
    }
  }

  function renderSummary() {
    const day = readRecords()[todayKey()] || {};
    const completed = MEAL_TYPES.filter(t => day[t.id]).length;
    const total = MEAL_TYPES.reduce((sum, t) => sum + (Number(day[t.id]?.price) || 0), 0);
    $("todayTotal").textContent = money(total);
    $("completedCount").textContent = completed;
    $("progressBar").style.width = `${completed / 3 * 100}%`;
    $("todayLabel").textContent = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date());
    $("dateChip").textContent = new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", weekday: "short" }).format(new Date());
  }

  function dateInRange(key, range) {
    const date = new Date(`${key}T12:00:00`);
    const now = new Date();
    if (range === "day") return key === todayKey();
    if (range === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - weekday);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return date >= start && date < end;
  }
  function renderStats() {
    const range = $("statsRange").value;
    const records = readRecords();
    const totals = { breakfast: 0, lunch: 0, dinner: 0 };
    for (const [date, meals] of Object.entries(records)) {
      if (!dateInRange(date, range)) continue;
      for (const type of MEAL_TYPES) totals[type.id] += Number(meals[type.id]?.price) || 0;
    }
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    $("rangeLabel").textContent = range === "day" ? "今日累計" : range === "week" ? "本週累計" : "本月累計";
    $("rangeTotal").textContent = money(total);
    $("breakfastTotal").textContent = money(totals.breakfast);
    $("lunchTotal").textContent = money(totals.lunch);
    $("dinnerTotal").textContent = money(totals.dinner);
    $("statsNote").textContent = range === "day" ? "統計今天已儲存的餐點。" : "統計此期間已儲存的餐點紀錄。";
  }

  function renderReminderStatus() {
    const settings = readSettings();
    const now = new Date();
    const day = readRecords()[todayKey()] || {};
    const pending = MEAL_TYPES.filter(t => !day[t.id]);
    const next = pending
      .map(t => ({ ...t, minutes: toMinutes(settings.times[t.id]) }))
      .filter(t => t.minutes >= now.getHours() * 60 + now.getMinutes())
      .sort((a, b) => a.minutes - b.minutes)[0];
    if (next) {
      $("nextReminderTitle").textContent = `下一餐：${next.label} ${settings.times[next.id]}`;
      $("nextReminderText").textContent = `時間到了還沒記錄時，記得吃飯並留下紀錄。`;
    } else if (pending.length) {
      $("nextReminderTitle").textContent = `今天還有 ${pending.length} 餐尚未記錄`;
      $("nextReminderText").textContent = "今天設定的用餐時間已過，記得補上紀錄。";
    } else {
      $("nextReminderTitle").textContent = "今天三餐都完成了！";
      $("nextReminderText").textContent = "做得很好，今天也有好好照顧自己。";
    }
    $("reminderStatus").textContent = settings.notifications ? "通知已啟用" : "網站內提醒";
  }

  function toMinutes(time) {
    const [h, m] = (time || "00:00").split(":").map(Number);
    return h * 60 + m;
  }

  function openMealEditor(typeId) {
    const type = MEAL_TYPES.find(t => t.id === typeId);
    const meal = getMeal(todayKey(), typeId);
    $("mealType").value = typeId;
    $("mealDialogTitle").textContent = meal ? `編輯${type.label}` : `記錄${type.label}`;
    $("mealName").value = meal?.name || "";
    $("mealPrice").value = meal?.price ?? "";
    $("mealTime").value = meal?.time || readSettings().times[typeId];
    $("mealNote").value = meal?.note || "";
    currentPhotoBlob = null;
    currentPhotoId = meal?.photoId || null;
    $("mealPhoto").value = "";
    $("photoPreviewWrap").hidden = true;
    if (meal?.photoId) {
      getPhoto(meal.photoId).then(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        $("photoPreview").src = url;
        $("photoPreviewWrap").hidden = false;
      });
    }
    openDialog("mealDialog");
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("請選擇圖片檔案");
    if (file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      return showToast("照片太大了，請選擇 5MB 以內的圖片");
    }
    currentPhotoBlob = await compressImage(file);
    $("photoPreview").src = URL.createObjectURL(currentPhotoBlob);
    $("photoPreviewWrap").hidden = false;
  }

  function compressImage(file) {
    return new Promise((resolve) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          resolve(blob || file);
        }, "image/jpeg", .82);
      };
      image.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      image.src = url;
    });
  }

  async function handleMealSubmit(event) {
    event.preventDefault();
    const typeId = $("mealType").value;
    const name = $("mealName").value.trim();
    const priceText = $("mealPrice").value;
    const price = priceText === "" ? 0 : Number(priceText);
    if (!Number.isFinite(price) || price < 0) return showToast("請輸入有效的餐費");
    let photoId = currentPhotoId;
    if (currentPhotoBlob) {
      photoId = `${todayKey()}-${typeId}`;
      try { await savePhoto(photoId, currentPhotoBlob); }
      catch { return showToast("照片儲存失敗，請確認瀏覽器空間"); }
    }
    const meal = { name, price, time: $("mealTime").value, note: $("mealNote").value.trim(), photoId: photoId || null, updatedAt: new Date().toISOString() };
    updateMeal(todayKey(), typeId, meal);
    closeDialog("mealDialog");
    await renderAll();
    showToast("餐點紀錄已儲存！");
    checkReminders();
  }

  function openReminderSettings() {
    const settings = readSettings();
    $("breakfastTime").value = settings.times.breakfast;
    $("lunchTime").value = settings.times.lunch;
    $("dinnerTime").value = settings.times.dinner;
    $("notificationsEnabled").checked = settings.notifications;
    openDialog("reminderDialog");
  }
  async function handleReminderSubmit(event) {
    event.preventDefault();
    const settings = {
      times: {
        breakfast: $("breakfastTime").value || "08:00",
        lunch: $("lunchTime").value || "12:00",
        dinner: $("dinnerTime").value || "18:00"
      },
      notifications: $("notificationsEnabled").checked
    };
    if (settings.notifications) {
      if (!("Notification" in window)) {
        settings.notifications = false;
        showToast("此瀏覽器不支援通知，已改為網站內提醒");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          settings.notifications = false;
          showToast("尚未取得通知權限，已保留網站內提醒");
        }
      }
    }
    writeSettings(settings);
    closeDialog("reminderDialog");
    renderReminderStatus();
    showToast("提醒設定已儲存");
    checkReminders();
  }

  function checkReminders() {
    const settings = readSettings();
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const day = readRecords()[todayKey()] || {};
    for (const type of MEAL_TYPES) {
      if (settings.times[type.id] !== current || day[type.id]) continue;
      const key = `mealReminderShown-${todayKey()}-${type.id}`;
      if (sessionStorage.getItem(key)) continue;
      sessionStorage.setItem(key, "1");
      const message = `${type.label}時間到了！記得吃飯，吃完可以回來記錄餐點與花費。`;
      showToast(message);
      if (settings.notifications && "Notification" in window && Notification.permission === "granted") {
        new Notification("好好吃飯提醒", { body: message, icon: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="#527c64"/><text x="50" y="66" text-anchor="middle" font-size="55" fill="white">食</text></svg>') });
      }
    }
    renderReminderStatus();
  }

  async function renderAll() {
    renderSummary();
    await renderMeals();
    renderStats();
    renderReminderStatus();
  }

  function bindEvents() {
    $("mealForm").addEventListener("submit", handleMealSubmit);
    $("mealPhoto").addEventListener("change", handlePhotoChange);
    $("removePhoto").addEventListener("click", () => {
      currentPhotoBlob = null;
      currentPhotoId = null;
      $("mealPhoto").value = "";
      $("photoPreviewWrap").hidden = true;
    });
    $("reminderForm").addEventListener("submit", handleReminderSubmit);
    $("statsRange").addEventListener("change", renderStats);
    $("settingsBtn").addEventListener("click", openReminderSettings);
    $("openReminderBtn").addEventListener("click", openReminderSettings);
    document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => closeDialog(btn.dataset.close)));
    ["mealDialog", "reminderDialog"].forEach(id => {
      $(id).addEventListener("click", (event) => {
        if (event.target === $(id)) closeDialog(id);
      });
    });
  }

  async function init() {
    try { db = await openDB(); }
    catch (error) { console.error(error); showToast("照片儲存功能無法啟動，請改用新版瀏覽器"); }
    bindEvents();
    await renderAll();
    checkReminders();
    setInterval(checkReminders, 15000);
  }
  document.addEventListener("DOMContentLoaded", init);
})();

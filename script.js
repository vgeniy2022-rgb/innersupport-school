const SITE_CONFIG = {
  telegramUrl: "https://t.me/Inner_Support_SkhoolRu",
  telegramChannelUrl: "https://t.me/Inner_Support_SkhoolRu",
  whatsappPhone: "79149647332",
  phoneDisplay: "+7 (914) 964-73-32",
  phoneHref: "tel:+79149647332",
  schoolName: "Школа внутренней опоры",
  lecturesGoogleSheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSMXn7MOnDuGJ4hDYB9bzsb7cjT1sqtWx57o1hchGg1lDnKJDc06-H_kgnuelBloA1NpTcCUrmNVm3z/pubhtml?gid=1122832629&single=true",
  literatureGoogleSheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSMXn7MOnDuGJ4hDYB9bzsb7cjT1sqtWx57o1hchGg1lDnKJDc06-H_kgnuelBloA1NpTcCUrmNVm3z/pub?gid=598249754&single=true&output=csv",
  useDemoFallback: false
};

/*
  Как подключить Google Таблицу:
  1. Создать Google Таблицу.
  2. Для лекций сделать колонки: id | title | date | time | format | price | type | tag | description | link | isActive.
  3. Для литературы сделать колонки: category | title | description | content | link | order | isActive.
  4. Файл -> Поделиться -> Опубликовать в интернете.
  5. Выбрать нужный лист и формат CSV.
  6. Вставить CSV-ссылки в SITE_CONFIG.lecturesGoogleSheetUrl и SITE_CONFIG.literatureGoogleSheetUrl.
*/

const state = {
  events: [],
  literature: [],
  currentMonth: new Date()
};

const elements = {
  heroEvent: document.querySelector("#heroEvent"),
  featuredEvent: document.querySelector("#featuredEvent"),
  eventsList: document.querySelector("#eventsList"),
  emptyEvents: document.querySelector("#emptyEvents"),
  pastEventsList: document.querySelector("#pastEventsList"),
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  mobileDayCard: document.querySelector("#mobileDayCard"),
  postsList: document.querySelector("#postsList"),
  modal: document.querySelector("#postModal"),
  modalClose: document.querySelector("#modalClose"),
  modalTitle: document.querySelector("#modalTitle"),
  modalTag: document.querySelector("#modalTag"),
  modalContent: document.querySelector("#modalContent"),
  burger: document.querySelector("#burger"),
  nav: document.querySelector("#mainNav")
};

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(first, second) {
  return toDateKey(first) === toDateKey(second);
}

function formatDate(dateString, options = {}) {
  return parseLocalDate(dateString).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...options
  });
}

function formatBookingDate(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Cannot load ${path}`);
    return await response.json();
  } catch (error) {
    return fallback;
  }
}

function whatsappUrl(message) {
  return `https://wa.me/${SITE_CONFIG.whatsappPhone}?text=${encodeURIComponent(message)}`;
}

function createBookingMessage(event) {
  const eventTypeName = eventType(event).toLowerCase() === "лекция" ? "лекцию" : eventType(event);
  const lines = [
    `Здравствуйте! Хочу записаться на ${eventTypeName} «${event.title}».`,
    "",
    `Дата: ${formatBookingDate(event.date)}`,
    `Время: ${event.time}`
  ];

  if (event.format) lines.push(`Формат: ${event.format}`);
  if (event.price) lines.push(`Стоимость: ${event.price}`);

  lines.push("", "Подскажите, пожалуйста, есть ли свободные места?");
  return lines.join("\n");
}

function createGeneralBookingUrl() {
  const message = "Здравствуйте! Хочу записаться на мероприятие Школы внутренней опоры. Подскажите, пожалуйста, какие ближайшие лекции доступны?";
  return whatsappUrl(message);
}

function setExternalLink(link) {
  link.target = "_blank";
  link.rel = "noopener noreferrer";
}

function shouldUseGoogleSheet(url) {
  return Boolean(url && url.trim() && !url.includes("ВСТАВЬ_СЮДА") && !url.includes("PASTE_GOOGLE"));
}

function toGoogleCsvUrl(url) {
  if (!url) return "";
  if (url.includes("output=csv")) return url;

  try {
    const sheetUrl = new URL(url);
    if (!sheetUrl.hostname.includes("docs.google.com")) return url;
    const gid = sheetUrl.searchParams.get("gid") || "0";
    const base = `${sheetUrl.origin}${sheetUrl.pathname.replace(/\/pubhtml$/, "/pub")}`;
    return `${base}?gid=${encodeURIComponent(gid)}&single=true&output=csv`;
  } catch (error) {
    return url;
  }
}

function parseCSV(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let isQuoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      isQuoted = !isQuoted;
    } else if (char === "," && !isQuoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !isQuoted) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function csvToObjects(csvText) {
  const [headers = [], ...rows] = parseCSV(csvText);
  const normalizedHeaders = headers.map((header) => header.trim());

  return rows.map((row) => normalizedHeaders.reduce((item, header, index) => {
    item[header] = (row[index] || "").trim();
    return item;
  }, {}));
}

function normalizeLiterature(items) {
  return items
    .map((item, index) => ({
      id: String(item.id || `literature-${index}`),
      category: item.category || item.tag || "",
      title: item.title || "",
      description: item.description || item.excerpt || "",
      content: item.content || "",
      link: item.link || "",
      order: item.order === "" || item.order == null ? null : Number(item.order),
      isActive: item.isActive == null ? "TRUE" : String(item.isActive)
    }))
    .filter((item) => item.category && item.title && item.description)
    .filter((item) => item.isActive.trim().toUpperCase() === "TRUE")
    .sort((first, second) => {
      const firstOrder = Number.isFinite(first.order) ? first.order : Number.MAX_SAFE_INTEGER;
      const secondOrder = Number.isFinite(second.order) ? second.order : Number.MAX_SAFE_INTEGER;
      return firstOrder - secondOrder || first.title.localeCompare(second.title, "ru");
    });
}

function normalizeEvents(items) {
  return items
    .map((item, index) => ({
      id: String(item.id || `event-${index}`),
      title: item.title || "",
      date: item.date || "",
      time: item.time || "",
      format: item.format || "",
      price: item.price || "",
      type: item.type || "Лекция",
      tag: item.tag || "",
      description: item.description || "",
      link: item.link || "",
      isActive: item.isActive == null ? "TRUE" : String(item.isActive)
    }))
    .filter((item) => item.title && item.date && item.time)
    .filter((item) => item.isActive.trim().toUpperCase() === "TRUE");
}

async function loadGoogleSheetRows(url, label) {
  const csvUrl = toGoogleCsvUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(csvUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`${label} Google Sheets CSV is not available`);
    return csvToObjects(await response.text());
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadEvents() {
  if (shouldUseGoogleSheet(SITE_CONFIG.lecturesGoogleSheetUrl)) {
    try {
      const googleEvents = normalizeEvents(await loadGoogleSheetRows(SITE_CONFIG.lecturesGoogleSheetUrl, "Lectures"));
      if (googleEvents.length || !SITE_CONFIG.useDemoFallback) return googleEvents;
    } catch (error) {
      console.warn("Не удалось загрузить лекции из Google Sheets:", error.message);
      if (!SITE_CONFIG.useDemoFallback) return [];
    }
  }

  return SITE_CONFIG.useDemoFallback || !shouldUseGoogleSheet(SITE_CONFIG.lecturesGoogleSheetUrl)
    ? normalizeEvents(await loadJson("data/events.json", []))
    : [];
}

async function loadLiterature() {
  if (shouldUseGoogleSheet(SITE_CONFIG.literatureGoogleSheetUrl)) {
    try {
      const googleLiterature = normalizeLiterature(await loadGoogleSheetRows(SITE_CONFIG.literatureGoogleSheetUrl, "Literature"));
      if (googleLiterature.length || !SITE_CONFIG.useDemoFallback) return googleLiterature;
    } catch (error) {
      console.warn("Не удалось загрузить литературу из Google Sheets:", error.message);
      if (!SITE_CONFIG.useDemoFallback) return [];
    }
  }

  return SITE_CONFIG.useDemoFallback || !shouldUseGoogleSheet(SITE_CONFIG.literatureGoogleSheetUrl)
    ? normalizeLiterature(await loadJson("data/literature.json", []))
    : [];
}

function applyConfig() {
  document.querySelectorAll("[data-config-link='booking']").forEach((link) => {
    link.href = createGeneralBookingUrl();
    setExternalLink(link);
  });
  document.querySelectorAll("[data-config-link='phone']").forEach((link) => {
    link.href = SITE_CONFIG.phoneHref;
    link.removeAttribute("target");
    link.removeAttribute("rel");
    link.textContent = link.textContent.includes("+7") ? SITE_CONFIG.phoneDisplay : link.textContent;
  });
  document.querySelectorAll("[data-config-text='phone']").forEach((item) => {
    item.textContent = SITE_CONFIG.phoneDisplay;
  });
  document.querySelectorAll("[data-config-link='telegram']").forEach((link) => {
    if (SITE_CONFIG.telegramUrl && SITE_CONFIG.telegramUrl !== "#") {
      link.href = SITE_CONFIG.telegramUrl;
      link.hidden = false;
      setExternalLink(link);
    } else {
      link.hidden = true;
      link.removeAttribute("href");
    }
  });
  document.querySelectorAll("[data-config-link='telegram-channel']").forEach((link) => {
    if (SITE_CONFIG.telegramChannelUrl && SITE_CONFIG.telegramChannelUrl !== "#") {
      link.href = SITE_CONFIG.telegramChannelUrl;
      link.hidden = false;
      setExternalLink(link);
    } else {
      link.hidden = true;
      link.removeAttribute("href");
    }
  });
  document.querySelectorAll(".brand span").forEach((item) => {
    item.textContent = SITE_CONFIG.schoolName;
  });
}

function getSortedEvents() {
  return [...state.events].sort((a, b) => {
    const dateDiff = parseLocalDate(a.date) - parseLocalDate(b.date);
    return dateDiff || a.time.localeCompare(b.time);
  });
}

function splitEvents() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getSortedEvents().reduce(
    (groups, event) => {
      if (parseLocalDate(event.date) >= today) groups.future.push(event);
      else groups.past.push(event);
      return groups;
    },
    { future: [], past: [] }
  );
}

function eventMeta(event) {
  return `${formatDate(event.date)}, ${event.time}`;
}

function eventType(event) {
  return event.type || "Событие";
}

function eventDetails(event) {
  return `${eventMeta(event)} · ${eventType(event)} · ${event.format} · ${event.price}`;
}

function eventPills(event) {
  return `
    <span class="pill">${eventMeta(event)}</span>
    <span class="pill">${eventType(event)}</span>
    <span class="pill">${event.format}</span>
    <span class="pill">${event.price}</span>
  `;
}

function eventSignupLink(event) {
  return event.link && event.link !== "#" ? event.link : whatsappUrl(createBookingMessage(event));
}

function eventLinkAttributes(event) {
  return eventSignupLink(event).startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
}

function eventCard(event) {
  return `
    <article class="event-card">
      <div>
        <span class="event-meta">${eventType(event)} · ${event.tag}</span>
        <h3>${event.title}</h3>
        <p>${event.description}</p>
      </div>
      <div class="pill-row">${eventPills(event)}</div>
      <a class="btn btn-primary" href="${eventSignupLink(event)}"${eventLinkAttributes(event)}>Записаться</a>
    </article>
  `;
}

function renderEvents() {
  const { future, past } = splitEvents();
  const [nearest, ...rest] = future;

  elements.emptyEvents.hidden = future.length > 0;
  elements.featuredEvent.hidden = !nearest;
  elements.eventsList.innerHTML = "";

  if (nearest) {
    elements.heroEvent.innerHTML = `
      <span>Ближайшая лекция</span>
      <strong>${nearest.title}</strong>
      <p>${eventDetails(nearest)}</p>
    `;
    elements.featuredEvent.innerHTML = `
      <div>
        <span class="event-meta">${eventType(nearest)} · ${nearest.tag}</span>
        <h3>${nearest.title}</h3>
        <p>${nearest.description}</p>
        <div class="pill-row">${eventPills(nearest)}</div>
      </div>
      <a class="btn btn-ghost" href="${eventSignupLink(nearest)}"${eventLinkAttributes(nearest)}>Записаться</a>
    `;
  } else {
    elements.heroEvent.innerHTML = `
      <span>Ближайшая лекция</span>
      <strong>Ближайшая лекция скоро появится</strong>
      <p>Расписание обновляется. Следите за анонсами в Telegram-канале школы.</p>
    `;
  }

  elements.eventsList.innerHTML = rest.map((event) => eventCard(event)).join("");
  elements.pastEventsList.innerHTML = past.length
    ? past.reverse().map((event) => `
      <div class="past-row">
        <strong>${event.title}</strong>
        <p>${eventDetails(event)} · ${event.tag}</p>
      </div>
    `).join("")
    : "<p>Архив пока пуст. Все еще впереди.</p>";
}

function eventsByDateKey() {
  return state.events.reduce((acc, event) => {
    acc[event.date] = acc[event.date] || [];
    acc[event.date].push(event);
    acc[event.date].sort((a, b) => a.time.localeCompare(b.time));
    return acc;
  }, {});
}

function renderCalendar() {
  const month = state.currentMonth.getMonth();
  const year = state.currentMonth.getFullYear();
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(year, month, 1 - startOffset);
  const monthTitle = state.currentMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const groupedEvents = eventsByDateKey();
  const hasEventsThisMonth = state.events.some((event) => {
    const eventDate = parseLocalDate(event.date);
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
  });

  elements.calendarTitle.textContent = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
  elements.calendarGrid.innerHTML = "";
  elements.mobileDayCard.innerHTML = "";
  elements.mobileDayCard.classList.remove("has-message");

  for (let index = 0; index < 42; index += 1) {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    const key = toDateKey(day);
    const dayEvents = groupedEvents[key] || [];
    const button = document.createElement("button");

    button.className = "calendar-day";
    button.type = "button";
    if (day.getMonth() !== month) button.classList.add("is-muted");
    if (isSameDay(day, today)) button.classList.add("is-today");
    if (dayEvents.length) button.classList.add("has-event");
    button.innerHTML = `
      <span class="day-number">${day.getDate()}</span>
      ${dayEvents.map(() => "<span class='event-dot'></span>").join("")}
      ${dayEvents.length ? `<div class="tooltip">${dayEvents.map((event) => `
        <strong>${event.time} · ${event.title}</strong>
        <p>${eventType(event)} · ${event.format} · ${event.price}</p>
      `).join("")}</div>` : ""}
    `;

    if (dayEvents.length) {
      button.addEventListener("click", () => renderMobileDayCard(dayEvents, day));
    }

    elements.calendarGrid.append(button);
  }

  if (!hasEventsThisMonth) {
    elements.mobileDayCard.classList.add("has-message");
    elements.mobileDayCard.innerHTML = `
      <div class="empty-state calendar-empty">
        <p>В этом месяце пока нет запланированных лекций.</p>
      </div>
    `;
  }
}

function renderMobileDayCard(events, date) {
  elements.mobileDayCard.classList.remove("has-message");
  elements.mobileDayCard.innerHTML = `
    <div class="event-card">
      <span class="event-meta">${date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span>
      ${events.map((event) => `
        <div class="past-row">
          <h3>${event.title}</h3>
          <p>${eventDetails(event)} · ${event.tag}</p>
          <a class="btn btn-primary" href="${eventSignupLink(event)}"${eventLinkAttributes(event)}>Записаться</a>
        </div>
      `).join("")}
    </div>
  `;
}

function renderLiterature() {
  if (!state.literature.length) {
    elements.postsList.innerHTML = `
      <article class="empty-state literature-empty">
        <h3>Литература скоро появится</h3>
        <p>Мы уже собираем полезные материалы.</p>
      </article>
    `;
    return;
  }

  elements.postsList.innerHTML = state.literature.map((item) => `
    <article class="post-card">
      <span class="post-tag">${item.category}</span>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      ${item.link
        ? `<a class="btn btn-ghost" href="${item.link}" target="_blank" rel="noopener noreferrer">Читать</a>`
        : `<button class="btn btn-ghost" data-literature-id="${item.id}">Читать</button>`}
    </article>
  `).join("");
}

function openLiteratureModal(itemId) {
  const item = state.literature.find((literatureItem) => String(literatureItem.id) === String(itemId));
  if (!item) return;

  elements.modalTitle.textContent = item.title;
  elements.modalTag.textContent = item.category;
  elements.modalContent.textContent = item.content || item.description;
  elements.modal.classList.add("is-open");
  elements.modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closePostModal() {
  elements.modal.classList.remove("is-open");
  elements.modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function setupMobileMenu() {
  elements.burger.addEventListener("click", () => {
    const isOpen = elements.nav.classList.toggle("is-open");
    elements.burger.classList.toggle("is-open", isOpen);
    elements.burger.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  });

  elements.nav.addEventListener("click", (event) => {
    if (!event.target.matches("a")) return;
    elements.nav.classList.remove("is-open");
    elements.burger.classList.remove("is-open");
    elements.burger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  });
}

function setupInteractions() {
  document.querySelector("#prevMonth").addEventListener("click", () => {
    state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  document.querySelector("#nextMonth").addEventListener("click", () => {
    state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  elements.postsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-literature-id]");
    if (button) openLiteratureModal(button.dataset.literatureId);
  });

  elements.modalClose.addEventListener("click", closePostModal);
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) closePostModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePostModal();
  });
}

function setupRevealAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));
}

async function init() {
  applyConfig();
  setupMobileMenu();
  setupInteractions();
  setupRevealAnimations();

  const [events, literature] = await Promise.all([
    loadEvents(),
    loadLiterature()
  ]);

  state.events = events;
  state.literature = literature;
  renderEvents();
  renderCalendar();
  renderLiterature();
}

init();

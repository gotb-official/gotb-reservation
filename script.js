const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwd4BDDKrX1juWrdHsmzQ7w89IDO51EYsaNAOnFOh-qkz5oIWOoO3SZiLgNgBqirjSF/exec";

const eventList = document.getElementById("eventList");
const eventsMessage = document.getElementById("eventsMessage");
const eventSelect = document.getElementById("eventSelect");
const reservationForm = document.getElementById("reservationForm");
const submitButton = document.getElementById("submitButton");
const formMessage = document.getElementById("formMessage");
const flyerModal = document.getElementById("flyerModal");
const flyerModalImage = document.getElementById("flyerModalImage");
const flyerModalClose = document.getElementById("flyerModalClose");

let openEvents = [];
let jsonpTimeoutId;
let lastFocusedElement = null;

function setEventsMessage(message, hidden = false) {
  eventsMessage.textContent = message;
  eventsMessage.classList.toggle("is-hidden", hidden);
}

function createText(value, fallback = "-") {
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function hasText(value) {
  return Boolean(value && String(value).trim());
}

function warnDuplicateEventIds(events) {
  const seenEventIds = new Set();
  const duplicateEventIds = new Set();

  events.forEach((event) => {
    if (!event || !hasText(event.event_id)) {
      return;
    }

    const eventId = String(event.event_id).trim();
    if (seenEventIds.has(eventId)) {
      duplicateEventIds.add(eventId);
    }
    seenEventIds.add(eventId);
  });

  duplicateEventIds.forEach((eventId) => {
    console.warn("Duplicate event_id found", eventId);
  });
}

function openFlyerModal(src, alt) {
  lastFocusedElement = document.activeElement;
  flyerModalImage.src = src;
  flyerModalImage.alt = alt;
  flyerModal.classList.add("is-open");
  flyerModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  flyerModalClose.focus();
}

function closeFlyerModal() {
  if (!flyerModal.classList.contains("is-open")) {
    return;
  }

  flyerModal.classList.remove("is-open");
  flyerModal.setAttribute("aria-hidden", "true");
  flyerModalImage.src = "";
  flyerModalImage.alt = "";
  document.body.classList.remove("modal-open");

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function selectEventForReservation(eventId) {
  eventSelect.value = eventId;
  formMessage.textContent = "";
  formMessage.className = "form-message";
  reservationForm.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("name").focus({ preventScroll: true });
}

function renderEvents(events) {
  const sourceEvents = Array.isArray(events) ? events : [];
  warnDuplicateEventIds(sourceEvents);

  openEvents = Array.isArray(events)
    ? events.filter((event) => event && event.status === "open")
    : [];

  eventList.innerHTML = "";
  eventSelect.innerHTML = '<option value="">イベントを選択してください</option>';

  if (!openEvents.length) {
    setEventsMessage("現在予約可能なイベントがありません");
    return;
  }

  setEventsMessage("", true);

  openEvents.forEach((event) => {
    const option = document.createElement("option");
    option.value = createText(event.event_id, "");
    option.textContent = `${createText(event.date)} / ${createText(event.title)}`;
    option.dataset.title = createText(event.title);
    eventSelect.appendChild(option);

    const card = document.createElement("article");
    card.className = "event-card";
    card.dataset.eventId = createText(event.event_id, "");

    if (hasText(event.flyer_url)) {
      const flyerButton = document.createElement("button");
      flyerButton.type = "button";
      flyerButton.className = "flyer-button";
      flyerButton.setAttribute("aria-label", `${createText(event.title)} のフライヤーを拡大表示`);

      const image = document.createElement("img");
      image.src = String(event.flyer_url).trim();
      image.alt = `${createText(event.title)} flyer`;
      image.loading = "lazy";

      flyerButton.appendChild(image);
      flyerButton.addEventListener("click", () => {
        openFlyerModal(String(event.flyer_url).trim(), image.alt);
      });
      card.appendChild(flyerButton);
    }

    const body = document.createElement("div");
    body.className = "event-body";

    const date = document.createElement("p");
    date.className = "event-date";
    date.textContent = createText(event.date);

    const title = document.createElement("h3");
    title.className = "event-title";
    title.textContent = createText(event.title);

    const meta = document.createElement("dl");
    meta.className = "event-meta";
    [
      ["Venue", createText(event.venue)],
      ["Open / Start", `${createText(event.open_time)} / ${createText(event.start_time)}`],
      ["ADV / DOOR", `${createText(event.adv_price)} / ${createText(event.door_price)}`]
    ].forEach(([label, value]) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      meta.appendChild(row);
    });

    const publicNote = document.createElement("div");
    publicNote.className = "public-note";

    if (hasText(event.public_note)) {
      const publicNoteLabel = document.createElement("span");
      publicNoteLabel.className = "public-note-label";
      publicNoteLabel.textContent = "INFO";

      const publicNoteText = document.createElement("p");
      publicNoteText.className = "public-note-text";
      publicNoteText.textContent = String(event.public_note).trim();

      publicNote.append(publicNoteLabel, publicNoteText);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "reserve-button";
    button.dataset.eventId = createText(event.event_id, "");
    button.textContent = "予約する";
    button.addEventListener("click", () => {
      selectEventForReservation(button.dataset.eventId);
    });

    body.append(date, title, meta);
    if (hasText(event.public_note)) {
      body.appendChild(publicNote);
    }
    body.appendChild(button);
    card.appendChild(body);
    eventList.appendChild(card);
  });
}

function loadEvents() {
  const callbackName = `gotbEventsCallback_${Date.now()}`;
  const script = document.createElement("script");
  const separator = GAS_WEB_APP_URL.includes("?") ? "&" : "?";

  window[callbackName] = (data) => {
    clearTimeout(jsonpTimeoutId);
    renderEvents(data);
    delete window[callbackName];
    script.remove();
  };

  script.src = `${GAS_WEB_APP_URL}${separator}callback=${callbackName}`;
  script.onerror = () => {
    clearTimeout(jsonpTimeoutId);
    setEventsMessage("現在予約可能なイベントがありません");
    delete window[callbackName];
    script.remove();
  };

  jsonpTimeoutId = window.setTimeout(() => {
    setEventsMessage("現在予約可能なイベントがありません");
    delete window[callbackName];
    script.remove();
  }, 10000);

  document.body.appendChild(script);
}

function getSelectedEvent() {
  return openEvents.find((event) => event.event_id === eventSelect.value);
}

function setFormMessage(message, type) {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
}

reservationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const selectedEvent = getSelectedEvent();
  const name = document.getElementById("name").value.trim();
  const tickets = document.getElementById("tickets").value.trim();

  if (!selectedEvent || !name || !tickets) {
    setFormMessage("必須項目を入力してください。", "error");
    return;
  }

  const formData = new FormData();
  formData.append("event_id", selectedEvent.event_id);
  formData.append("event_title", selectedEvent.title);
  formData.append("name", name);
  formData.append("tickets", tickets);
  formData.append("email", document.getElementById("email").value.trim());
  formData.append("note", document.getElementById("note").value.trim());

  submitButton.disabled = true;
  submitButton.textContent = "送信中...";
  formMessage.textContent = "";
  formMessage.className = "form-message";

  try {
    await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      body: formData
    });

    reservationForm.reset();
    setFormMessage("予約を受け付けました。当日は受付にて予約名をお伝えください。", "success");
  } catch (error) {
    setFormMessage("送信できませんでした。時間をおいてもう一度お試しください。", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "予約を送信する";
  }
});

flyerModalClose.addEventListener("click", closeFlyerModal);

flyerModal.addEventListener("click", (event) => {
  if (event.target === flyerModal) {
    closeFlyerModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFlyerModal();
  }
});

loadEvents();

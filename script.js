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
const flyerModalPrev = document.getElementById("flyerModalPrev");
const flyerModalNext = document.getElementById("flyerModalNext");
const flyerModalCounter = document.getElementById("flyerModalCounter");

let openEvents = [];
let jsonpTimeoutId;
let lastFocusedElement = null;
let modalImages = [];
let currentImageIndex = 0;

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

function getDateSortKey(event) {
  if (event && event.date_sort && /^\d{4}-\d{2}-\d{2}$/.test(String(event.date_sort).trim())) {
    return String(event.date_sort).trim();
  }

  const digits = String((event && event.date) || "").replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  return "";
}

function sortEventsByDate(events) {
  return events.slice().sort((a, b) => {
    const aKey = getDateSortKey(a);
    const bKey = getDateSortKey(b);

    if (!aKey && !bKey) return 0;
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey.localeCompare(bKey);
  });
}

function getTicketType(event) {
  if (hasText(event.ticket_type)) {
    return String(event.ticket_type).trim();
  }

  if (hasText(event.adv_price) || hasText(event.door_price)) {
    return "adv_door";
  }

  return "none";
}

function getTicketDisplay(event) {
  const ticketType = getTicketType(event);

  if (ticketType === "adv_door") {
    const advPrice = hasText(event.adv_price) ? String(event.adv_price).trim() : "";
    const doorPrice = hasText(event.door_price) ? String(event.door_price).trim() : "";
    if (!advPrice && !doorPrice) {
      return null;
    }
    return {
      label: "ADV / DOOR",
      value: `${advPrice || "-"} / ${doorPrice || "-"}`
    };
  }

  if (ticketType === "single") {
    if (!hasText(event.ticket_price)) {
      return null;
    }
    return {
      label: "TICKET",
      value: String(event.ticket_price).trim()
    };
  }

  if (ticketType === "free") {
    return {
      label: "TICKET",
      value: "FREE"
    };
  }

  return null;
}

function getRelatedImageUrls(event) {
  return String((event && event.related_image_urls) || "")
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function getEventImages(event) {
  const images = [];

  if (hasText(event.flyer_url)) {
    images.push({
      src: String(event.flyer_url).trim(),
      alt: `${createText(event.title)} flyer`
    });
  }

  getRelatedImageUrls(event).forEach((url, index) => {
    images.push({
      src: url,
      alt: `${createText(event.title)} related image ${index + 1}`
    });
  });

  return images;
}

function renderModalImage() {
  const image = modalImages[currentImageIndex];
  if (!image) {
    return;
  }

  flyerModalImage.src = image.src;
  flyerModalImage.alt = image.alt;
  flyerModalCounter.textContent = `${currentImageIndex + 1} / ${modalImages.length}`;
  const hasMultipleImages = modalImages.length > 1;
  flyerModalPrev.classList.toggle("is-hidden", !hasMultipleImages);
  flyerModalNext.classList.toggle("is-hidden", !hasMultipleImages);
  flyerModalCounter.classList.toggle("is-hidden", !hasMultipleImages);
}

function openFlyerModal(images, startIndex = 0) {
  modalImages = images;
  currentImageIndex = startIndex;
  lastFocusedElement = document.activeElement;
  renderModalImage();
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
  modalImages = [];
  currentImageIndex = 0;
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

  openEvents = sortEventsByDate(
    Array.isArray(events)
      ? events.filter((event) => event && event.status === "open")
      : []
  );

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
    const eventImages = getEventImages(event);

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
        openFlyerModal(eventImages, 0);
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

    const presenter = document.createElement("p");
    presenter.className = "event-presenter";
    presenter.textContent = hasText(event.presenter) ? String(event.presenter).trim() : "";

    const meta = document.createElement("dl");
    meta.className = "event-meta";
    const ticketDisplay = getTicketDisplay(event);
    const metaRows = [
      ["Venue", createText(event.venue)],
      ["Open / Start", `${createText(event.open_time)} / ${createText(event.start_time)}`]
    ];

    if (ticketDisplay) {
      metaRows.push([ticketDisplay.label, ticketDisplay.value]);
    }

    metaRows.forEach(([label, value]) => {
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

    const relatedButton = document.createElement("button");
    relatedButton.type = "button";
    relatedButton.className = "related-image-button";
    relatedButton.textContent = "関連画像を見る";
    relatedButton.addEventListener("click", () => {
      openFlyerModal(eventImages, hasText(event.flyer_url) ? 1 : 0);
    });

    body.append(date);
    if (hasText(event.presenter)) {
      body.appendChild(presenter);
    }
    body.append(title, meta);
    if (hasText(event.public_note)) {
      body.appendChild(publicNote);
    }
    if (!hasText(event.flyer_url) && eventImages.length) {
      body.appendChild(relatedButton);
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

flyerModalPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!modalImages.length) return;
  currentImageIndex = (currentImageIndex - 1 + modalImages.length) % modalImages.length;
  renderModalImage();
});

flyerModalNext.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!modalImages.length) return;
  currentImageIndex = (currentImageIndex + 1) % modalImages.length;
  renderModalImage();
});

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

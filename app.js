const SUPABASE_URL = "https://dmfgcszvvinjrtlwvema.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_aZfDPxMps_O5oTJrIvVNMA_3uTXlrib";

const supabaseClient = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
}) : null;

const FALLBACK_ROOM_IMAGES = [
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1000&q=85",
  "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=85",
];

const state = {
  rooms: [],
  selectedRoomId: "",
  loading: false,
  channel: null,
  contentChannel: null,
};

const roomGrid = document.getElementById("roomsGrid");
const roomSelect = document.getElementById("roomId");
const availableCount = document.getElementById("availableCount");
const statusMessage = document.getElementById("statusMessage");
const bookingForm = document.getElementById("bookingForm");
const submitButton = bookingForm.querySelector('button[type="submit"]');
const roomModal = document.getElementById("roomModal");
const roomModalClose = document.getElementById("roomModalClose");
const roomModalReserve = document.getElementById("roomModalReserve");
const siteContentNotice = document.getElementById("siteContentNotice");
const siteLoader = document.getElementById("siteLoader");
let modalTrigger = null;
let modalRoom = null;

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function hideSiteLoader() {
  if (!siteLoader || siteLoader.classList.contains("is-hidden")) return;
  siteLoader.classList.add("is-hidden");
  window.setTimeout(() => siteLoader.remove(), 500);
}

function formatMoney(value) {
  return `S/ ${Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function photoForRoom(room, index) {
  if (typeof room.photo_url === "string") {
    try {
      const photo = new URL(room.photo_url);
      if (photo.protocol === "https:") return photo.href;
    } catch {
      // Use the built-in room photo when no valid HTTPS image is configured.
    }
  }
  return FALLBACK_ROOM_IMAGES[index % FALLBACK_ROOM_IMAGES.length];
}

function createRoomCard(room, index) {
  const card = document.createElement("article");
  card.className = "room-card reveal";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-haspopup", "dialog");
  card.setAttribute("aria-label", `Ver detalles de habitación ${room.number}, ${room.type}`);

  const photoWrap = document.createElement("div");
  photoWrap.className = "room-thumb-wrap";
  const photo = document.createElement("img");
  photo.className = "room-thumb";
  photo.src = photoForRoom(room, index);
  photo.alt = `Habitación ${room.number}, ${room.type}`;
  photo.loading = "lazy";
  photoWrap.append(photo);

  const number = document.createElement("span");
  number.className = "room-index";
  number.textContent = `EMB HOTEL · ${String(index + 1).padStart(2, "0")}`;
  photoWrap.append(number);

  const body = document.createElement("div");
  body.className = "room-body";
  const top = document.createElement("div");
  top.className = "room-top";
  const name = document.createElement("span");
  name.className = "room-name";
  name.textContent = `Habitación ${room.number}`;
  const badge = document.createElement("span");
  badge.className = `status-badge status-${room.status}`;
  badge.textContent = room.status === "disponible" ? "Disponible" :
    room.status === "mantenimiento" ? "No disponible" :
      room.status === "limpieza" ? "En preparación" : "Ocupada";
  top.append(name, badge);

  const type = document.createElement("div");
  type.className = "room-type";
  type.textContent = room.type || "Habitación";

  const details = document.createElement("div");
  details.className = "room-details";
  const price = document.createElement("div");
  price.className = "room-price";
  price.append(document.createTextNode(formatMoney(room.price_night)));
  const perNight = document.createElement("small");
  perNight.textContent = " / noche";
  price.append(perNight);

  details.append(price);
  if (Array.isArray(room.amenities) && room.amenities.length > 0) {
    const features = document.createElement("ul");
    features.className = "room-feature-list";
    room.amenities.forEach((amenity) => {
      const item = document.createElement("li");
      item.textContent = amenity;
      features.append(item);
    });
    body.append(type, features, details);
  } else {
    body.append(type, details);
  }
  body.prepend(top);
  card.append(photoWrap, body);
  card.addEventListener("click", () => openRoomModal(room, card, index));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRoomModal(room, card, index);
    }
  });
  return card;
}

function openRoomModal(room, trigger, index) {
  modalTrigger = trigger;
  modalRoom = room;
  document.getElementById("roomModalImage").src = photoForRoom(room, index);
  document.getElementById("roomModalImage").alt = `Habitación ${room.number}, ${room.type}`;
  document.getElementById("roomModalNumber").textContent = `EMB HOTEL · HABITACIÓN ${room.number}`;
  document.getElementById("roomModalTitle").textContent = `Habitación ${room.number}`;
  document.getElementById("roomModalType").textContent = room.type || "Habitación";

  const statusText = room.status === "disponible" ? "Disponible" :
    room.status === "mantenimiento" ? "No disponible" :
      room.status === "limpieza" ? "En preparación" : "Ocupada";
  const statusBadge = document.getElementById("roomModalStatus");
  statusBadge.className = `status-badge status-${room.status}`;
  statusBadge.textContent = statusText;

  const features = document.getElementById("roomModalFeatures");
  features.replaceChildren();
  const amenities = Array.isArray(room.amenities) && room.amenities.length
    ? room.amenities
    : ["Características por confirmar"];
  amenities.forEach((amenity) => {
    const item = document.createElement("li");
    item.textContent = amenity;
    features.append(item);
  });

  const price = document.getElementById("roomModalPrice");
  price.replaceChildren(document.createTextNode(formatMoney(room.price_night)));
  const perNight = document.createElement("small");
  perNight.textContent = " / noche";
  price.append(perNight);
  roomModalReserve.disabled = room.status === "mantenimiento";
  roomModalReserve.textContent = room.status === "mantenimiento"
    ? "No disponible por ahora"
    : "Consultar disponibilidad";
  roomModal.showModal();
  roomModalClose.focus();
}

function closeRoomModal() {
  if (roomModal.open) roomModal.close();
}

function renderRooms() {
  roomGrid.replaceChildren();

  if (!state.rooms.length) {
    roomGrid.append(createRoomNotice(
      "Aún no hay habitaciones publicadas. La disponibilidad aparecerá aquí cuando el hotel termine de configurar su inventario.",
      "empty",
    ));
  } else {
    state.rooms.forEach((room, index) => {
      roomGrid.append(createRoomCard(room, index));
    });
  }

  const selected = state.selectedRoomId;
  roomSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.rooms.length ? "Selecciona una habitación" : "Disponibilidad no configurada";
  roomSelect.append(placeholder);

  state.rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = `${room.number} · ${room.type} · ${formatMoney(room.price_night)} / noche`;
    option.disabled = room.status === "mantenimiento";
    roomSelect.append(option);
  });
  if (state.rooms.some((room) => room.id === selected)) {
    roomSelect.value = selected;
  }
  roomSelect.disabled = state.rooms.length === 0;
  submitButton.disabled = state.rooms.length === 0;

  availableCount.textContent = state.rooms.filter((room) => room.status === "disponible").length;
  observeReveals();
}

async function loadRooms() {
  if (!supabaseClient) {
    showRoomNotice("No se pudo iniciar la conexión con el servicio de reservas.", "error");
    setStatus("No se cargó el servicio de reservas. Recarga la página o inténtalo más tarde.", "error");
    return;
  }

  const { data, error } = await supabaseClient.from("rooms").select("id, number, type, price_night, status, photo_url, amenities").order("number");

  if (error) {
    showRoomNotice("No se pudo cargar la disponibilidad. Inténtalo de nuevo más tarde.", "error");
    setStatus("No se pudo consultar la disponibilidad. Inténtalo de nuevo más tarde.", "error");
    return;
  }

  state.rooms = data || [];
  renderRooms();
  if (statusMessage.classList.contains("error")) setStatus("");
}

function contentImageUrl(path) {
  if (!path) return "";
  if (/^https:\/\//i.test(path)) return path;
  return supabaseClient.storage.from("website-assets").getPublicUrl(path).data.publicUrl;
}

function setContentImage(id, path) {
  const image = document.getElementById(id);
  if (!image || !path) return;
  const url = contentImageUrl(path);
  image.onerror = () => {
    image.onerror = null;
    image.src = image.dataset.defaultSrc;
  };
  image.src = url;
}

function applyWebsiteContent(content) {
  const fields = {
    heroEyebrow: "hero_eyebrow",
    heroTitle: "hero_title",
    heroDescription: "hero_description",
    introTitle: "intro_title",
    introDescription: "intro_description",
    storyEyebrow: "story_eyebrow",
    storyTitle: "story_title",
    storyDescription: "story_description",
    galleryTitle: "gallery_title",
    servicesTitle: "services_title",
    servicesDescription: "services_description",
    benefitOneTitle: "benefit_one_title",
    benefitOneText: "benefit_one_text",
    benefitTwoTitle: "benefit_two_title",
    benefitTwoText: "benefit_two_text",
    benefitThreeTitle: "benefit_three_title",
    benefitThreeText: "benefit_three_text",
  };
  Object.entries(fields).forEach(([elementId, field]) => {
    const element = document.getElementById(elementId);
    if (element && typeof content[field] === "string") element.textContent = content[field];
  });

  (content.hero_images || []).slice(0, 5).forEach((path, index) => {
    const slide = document.querySelector(`.hero-image[data-slide="${index}"]`);
    if (!slide || !path) return;
    const url = contentImageUrl(path).replace(/["\\\n\r]/g, "");
    slide.style.setProperty("--hero-photo", `url("${url}")`);
  });
  setContentImage("introImage", content.intro_image);
  setContentImage("storyImage", content.story_image);
  (content.gallery_images || []).slice(0, 6).forEach((path, index) => {
    setContentImage(`galleryImage${index}`, path);
  });
}

async function loadWebsiteContent() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("website_content")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("No se pudo cargar el contenido editable del sitio:", error);
    siteContentNotice.textContent = "Mostramos contenido e imágenes provisionales mientras se configura el editor del sitio.";
    siteContentNotice.hidden = false;
    return;
  }
  if (!data) {
    siteContentNotice.textContent = "Las imágenes y textos de esta página son provisionales y pueden actualizarse desde el software del hotel.";
    siteContentNotice.hidden = false;
    return;
  }
  siteContentNotice.hidden = true;
  applyWebsiteContent(data);
}

function showRoomNotice(message, kind = "loading") {
  roomGrid.replaceChildren(createRoomNotice(message, kind));
  roomSelect.replaceChildren();
  const option = document.createElement("option");
  option.value = "";
  option.textContent = "Disponibilidad temporalmente no disponible";
  roomSelect.append(option);
  roomSelect.disabled = true;
  submitButton.disabled = true;
}

function createRoomNotice(message, kind) {
  const notice = document.createElement("div");
  notice.className = `empty-rooms ${kind === "error" ? "is-notice" : ""}`;
  notice.setAttribute("role", "status");
  const copy = document.createElement("div");
  copy.className = "empty-room-copy";
  const label = document.createElement("span");
  label.className = "section-tag";
  label.textContent = "EMB HOTEL · HABITACIONES";
  const heading = document.createElement("strong");
  heading.textContent = kind === "empty" ? "Tu espacio en Satipo." :
    kind === "loading" ? "Cargando disponibilidad." : "Disponibilidad no disponible por ahora.";
  const description = document.createElement("p");
  description.textContent = message;
  copy.append(label, heading, description);
  notice.append(copy);
  return notice;
}

function setBookingBusy(busy) {
  state.loading = busy;
  submitButton.disabled = busy || state.rooms.length === 0;
  submitButton.querySelector("span").textContent = busy ? "Enviando solicitud…" : "Solicitar reserva";
  bookingForm.setAttribute("aria-busy", String(busy));
}

async function reserveRoom(event) {
  event.preventDefault();
  if (state.loading) return;

  const guestName = document.getElementById("guestName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const roomId = roomSelect.value;
  const checkIn = document.getElementById("checkIn").value;
  const checkOut = document.getElementById("checkOut").value;
  const email = document.getElementById("email").value.trim();
  const notes = document.getElementById("notes").value.trim();

  if (!roomId || !guestName || !phone || !checkIn || !checkOut) {
    setStatus("Completa los campos obligatorios para enviar tu solicitud.", "error");
    return;
  }
  if (checkOut <= checkIn) {
    setStatus("La fecha de salida debe ser posterior a la fecha de entrada.", "error");
    return;
  }

  setBookingBusy(true);
  setStatus("Estamos comprobando las fechas y enviando tu solicitud…");

  try {
    const { error } = await supabaseClient.rpc("public_create_reservation", {
      p_room_id: roomId,
      p_guest_name: guestName,
      p_phone: phone,
      p_email: email || null,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_notes: notes || null,
    });

    if (error) {
      const message = error.message.toLowerCase().includes("reservad") ||
        error.message.toLowerCase().includes("ocupad")
        ? "La habitación ya no está disponible para esas fechas. Elige otra opción o cambia las fechas."
        : "No se pudo completar la solicitud. Inténtalo de nuevo o comunícate con el hotel.";
      setStatus(message, "error");
      await loadRooms();
      return;
    }

    setStatus("Recibimos tu solicitud. El equipo de EMB HOTEL se pondrá en contacto contigo para confirmar la reserva.", "success");
    bookingForm.reset();
    state.selectedRoomId = "";
    document.getElementById("checkIn").value = localDate();
    document.getElementById("checkOut").value = localDate(1);
    await loadRooms();
  } catch {
    setStatus("No se pudo conectar con el servicio de reservas. Comprueba tu conexión e inténtalo de nuevo.", "error");
  } finally {
    setBookingBusy(false);
  }
}

function bindNavigation() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (roomModal.open) {
      event.preventDefault();
      closeRoomModal();
    }
  });
}

function bindSectionNavigation() {
  const links = Array.from(document.querySelectorAll("#mainMenu a[href^='#']"));
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  const activate = (id) => {
    links.forEach((link) => {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  links.forEach((link) => link.addEventListener("click", () => activate(link.hash.slice(1))));
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    const active = entries
      .filter((entry) => entry.isIntersecting)
      .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
    if (active) activate(active.target.id);
  }, { rootMargin: "-22% 0px -62% 0px", threshold: [0, 0.2, 0.5, 0.8] });
  sections.forEach((section) => observer.observe(section));
}

let revealObserver;
function observeReveals() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
  }
  document.querySelectorAll(".reveal:not(.is-visible)").forEach((element) => revealObserver.observe(element));
}

function bindDateInputs() {
  const checkIn = document.getElementById("checkIn");
  const checkOut = document.getElementById("checkOut");
  checkIn.min = localDate();
  checkOut.min = localDate(1);
  checkIn.addEventListener("change", () => {
    const earliestDeparture = localDate(1) > checkIn.value ? localDate(1) : checkIn.value;
    checkOut.min = earliestDeparture;
    if (checkOut.value <= checkIn.value) {
      const next = new Date(`${checkIn.value}T12:00:00`);
      next.setDate(next.getDate() + 1);
      checkOut.value = new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }
  });
}

function bindHeroSlides() {
  const slides = Array.from(document.querySelectorAll(".hero-image"));
  const controls = Array.from(document.querySelectorAll(".hero-dot"));
  if (!slides.length || slides.length !== controls.length) return;

  let activeIndex = 0;
  const showSlide = (index) => {
    activeIndex = index;
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
    controls.forEach((control, i) => {
      control.classList.toggle("is-active", i === index);
      control.setAttribute("aria-pressed", String(i === index));
    });
  };
  controls.forEach((control, index) => {
    control.addEventListener("click", () => showSlide(index));
  });
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.setInterval(() => showSlide((activeIndex + 1) % slides.length), 7000);
  }
}

function bindRealtime() {
  if (!supabaseClient) return;
  state.channel = supabaseClient
    .channel("web_hotel_availability")
    .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, loadRooms)
    .subscribe((status) => {
      const indicator = document.getElementById("connectionStatus");
      if (status === "SUBSCRIBED") {
        indicator.textContent = "Conectado en vivo";
        indicator.classList.add("is-connected");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        indicator.textContent = "Consulta al enviar";
        indicator.classList.remove("is-connected");
      }
    });
  state.contentChannel = supabaseClient
    .channel("web_hotel_content")
    .on("postgres_changes", { event: "*", schema: "public", table: "website_content" }, loadWebsiteContent)
    .subscribe();
}

async function init() {
  document.getElementById("currentYear").textContent = new Date().getFullYear();
  document.getElementById("checkIn").value = localDate();
  document.getElementById("checkOut").value = localDate(1);
  bindNavigation();
  bindSectionNavigation();
  bindDateInputs();
  roomSelect.addEventListener("change", () => {
    state.selectedRoomId = roomSelect.value;
  });
  bookingForm.addEventListener("submit", reserveRoom);
  roomModalClose.addEventListener("click", closeRoomModal);
  roomModal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeRoomModal();
  });
  roomModal.addEventListener("click", (event) => {
    if (event.target === roomModal) closeRoomModal();
  });
  roomModal.addEventListener("close", () => {
    if (modalTrigger?.isConnected) modalTrigger.focus();
    modalRoom = null;
  });
  roomModalReserve.addEventListener("click", () => {
    if (!modalRoom || roomModalReserve.disabled) return;
    state.selectedRoomId = modalRoom.id;
    roomSelect.value = modalRoom.id;
    closeRoomModal();
    document.getElementById("reserva").scrollIntoView({ behavior: "smooth" });
    document.getElementById("guestName").focus({ preventScroll: true });
  });
  document.getElementById("checkIn").addEventListener("change", () => {
    setStatus("");
  });
  document.getElementById("checkOut").addEventListener("change", () => {
    setStatus("");
  });
  bindHeroSlides();
  observeReveals();
  showRoomNotice("Estamos consultando las habitaciones publicadas.", "loading");
  const roomRequest = loadRooms().catch((error) => {
    console.error("No se pudo completar la carga de habitaciones:", error);
    showRoomNotice("No se pudo consultar la disponibilidad. Recarga la página para intentarlo de nuevo.", "error");
    setStatus("No se pudo consultar la disponibilidad. Inténtalo de nuevo más tarde.", "error");
  });
  const contentRequest = loadWebsiteContent().catch((error) => {
    console.error("No se pudo completar la carga del contenido del sitio:", error);
    siteContentNotice.textContent = "Mostramos contenido e imágenes provisionales mientras se configura el editor del sitio.";
    siteContentNotice.hidden = false;
  });
  const initialLoad = Promise.all([roomRequest, contentRequest]);
  const minimumLoaderTime = new Promise((resolve) => window.setTimeout(resolve, 850));
  const startupLimit = new Promise((resolve) => window.setTimeout(resolve, 4500));
  await Promise.race([Promise.all([initialLoad, minimumLoaderTime]), startupLimit]);
  hideSiteLoader();
  bindRealtime();

  const header = document.querySelector(".topbar");
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 8);
  }, { passive: true });
}

init();

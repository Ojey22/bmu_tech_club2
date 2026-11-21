/**
 * Loads the homepage event and team content from the backend JSON APIs.
 * Existing CSS classes and card structure are deliberately reused so the
 * visual design remains unchanged. Static HTML stays visible as a fallback
 * whenever the API is unavailable.
 */
(() => {
  const API_BASE = window.API_BASE_URL || "http://localhost:5000";

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  };

  const formatEventDate = (event) => {
    if (typeof event.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
      const [year, month, day] = event.date.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return {
        day: String(day).padStart(2, "0"),
        month: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()
      };
    }

    const displayDate = String(event.displayDate || "").trim();
    const match = displayDate.match(/^(\d{1,2})\s+([A-Za-z]+)/);
    return match
      ? { day: match[1].padStart(2, "0"), month: match[2].slice(0, 3).toUpperCase() }
      : { day: "TBA", month: "" };
  };

  const renderEvents = (events) => {
    const container = document.querySelector(".events-container");
    if (!container || !Array.isArray(events) || events.length === 0) return;

    const fragment = document.createDocumentFragment();

    events.forEach((event) => {
      const card = createElement("div", "event-card");
      const dateBox = createElement("div", "event-date");
      const dateParts = formatEventDate(event);
      dateBox.append(
        createElement("h3", "", dateParts.day),
        createElement("p", "", dateParts.month)
      );

      const info = createElement("div", "event-info");
      info.append(
        createElement("h3", "", event.title || event.name || "Untitled event"),
        createElement("p", "", event.description || "")
      );

      if (event.registrationPage) {
        const link = createElement("a", "register-btn", "Register Now");
        link.href = event.registrationPage;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        info.append(link);
      }

      card.append(dateBox, info);
      fragment.append(card);
    });

    container.replaceChildren(fragment);
  };

  const renderTeam = (members) => {
    const container = document.querySelector(".team-container");
    if (!container || !Array.isArray(members) || members.length === 0) return;

    const fragment = document.createDocumentFragment();

    members.forEach((member) => {
      const card = createElement("div", "team-card");
      const profileCircle = createElement("div", "profile-circle");
      const image = createElement("img");
      image.src = member.image || "";
      image.alt = member.name ? `${member.name} profile photo` : "Team member";
      image.loading = "lazy";
      profileCircle.append(image);

      card.append(
        profileCircle,
        createElement("h3", "", member.name || "Team member"),
        createElement("p", "", member.role || "")
      );
      fragment.append(card);
    });

    container.replaceChildren(fragment);
  };

  const fetchJson = async (endpoint) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`${endpoint} returned HTTP ${response.status}`);

    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(result.message || `Invalid response from ${endpoint}`);
    }
    return result.data;
  };

  document.addEventListener("DOMContentLoaded", () => {
    fetchJson("/api/local-data/events")
      .then(renderEvents)
      .catch((error) => console.warn("Using static homepage events:", error.message));

    fetchJson("/api/local-data/team")
      .then(renderTeam)
      .catch((error) => console.warn("Using static homepage team:", error.message));
  });
})();

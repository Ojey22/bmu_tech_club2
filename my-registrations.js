document.addEventListener("DOMContentLoaded", async () => {
    const message = document.getElementById("registrationsMessage");
    const container = document.getElementById("registrationsContainer");

    if (!message || !container) return;

    const token = localStorage.getItem("authToken");
    if (!token) {
        message.textContent = "Please sign in to view your registrations.";
        return;
    }

    const apiBase = window.API_BASE_URL || "https://bmu-tech-club-backend.onrender.com";

    const createTextElement = (tag, className, text) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = text;
        return element;
    };

    const formatEventDate = (eventDetails) => {
        if (eventDetails.displayDate) return eventDetails.displayDate;
        if (eventDetails.date) {
            const parsedDate = new Date(`${eventDetails.date}T00:00:00`);
            if (!Number.isNaN(parsedDate.getTime())) {
                return parsedDate.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });
            }
        }
        return "Not announced";
    };

    try {
        message.textContent = "Loading your registrations...";

        const response = await fetch(`${apiBase}/api/registrations/my`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.status === 401) {
            message.textContent = "Your session has expired. Please sign in again.";
            return;
        }

        if (!response.ok || !result.success || !Array.isArray(result.data)) {
            throw new Error(result.message || "Unable to load registrations.");
        }

        if (result.data.length === 0) {
            message.textContent = "You haven't registered for any events yet.";
            return;
        }

        message.textContent = "";
        const fragment = document.createDocumentFragment();

        result.data.forEach((registration) => {
            const eventDetails = registration.eventDetails || {};
            const card = document.createElement("article");
            card.className = "registration-card";

            const eventTitle = eventDetails.title || registration.eventName || "Event";
            card.append(
                createTextElement("h2", "", eventTitle),
                createTextElement("p", "registration-status", "Registered"),
                createTextElement("p", "", `Name: ${registration.fullName || "N/A"}`),
                createTextElement("p", "", `Enrollment Number: ${registration.enrollmentNumber || "N/A"}`),
                createTextElement("p", "", `Email: ${registration.email || "N/A"}`),
                createTextElement("p", "", `Course: ${registration.course || "N/A"}`),
                createTextElement("p", "", `Event Date: ${formatEventDate(eventDetails)}`),
                createTextElement("p", "", `Time: ${eventDetails.time || "Not announced"}`),
                createTextElement("p", "", `Venue: ${eventDetails.venue || "Not announced"}`),
                createTextElement(
                    "p",
                    "",
                    `Registration Date: ${registration.createdAt
                        ? new Date(registration.createdAt).toLocaleDateString()
                        : "N/A"}`
                )
            );

            fragment.append(card);
        });

        container.replaceChildren(fragment);
    } catch (error) {
        console.error("Registration loading error:", error);
        message.textContent = "Something went wrong while loading your registrations. Please try again later.";
    }
});

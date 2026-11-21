const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_DIRECTORY = path.join(__dirname, "../data");
const EVENTS_FILE_PATH = path.join(DATA_DIRECTORY, "events.json");
const TEAM_FILE_PATH = path.join(DATA_DIRECTORY, "team.json");

// Serialize write operations in this Node process so two admin requests cannot
// overwrite one another after reading the same old JSON snapshot.
let writeQueue = Promise.resolve();

const withWriteLock = (operation) => {
  const pending = writeQueue.then(operation, operation);
  writeQueue = pending.catch(() => undefined);
  return pending;
};

const readJsonArray = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error(`Expected an array in ${path.basename(filePath)}.`);
    }

    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

const writeJsonArray = async (filePath, values) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(values, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
};

const cleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const slugify = (value) =>
  cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const isValidId = (value) =>
  typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

const isValidIsoDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validateRegistrationPage = (value) => {
  if (value === undefined || value === null || value === "") return true;
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.html$/.test(value)
  );
};

const validateEvent = (input, { creating = false } = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Request body must be a JSON object." };
  }

  const title = input.title === undefined ? undefined : cleanString(input.title);
  const date = input.date === undefined ? undefined : cleanString(input.date);
  const venue = input.venue === undefined ? undefined : cleanString(input.venue);

  if (creating && (!title || !date || !venue)) {
    return { error: "Please provide event title, date (YYYY-MM-DD), and venue." };
  }
  if (title !== undefined && !title) return { error: "Event title cannot be empty." };
  if (date !== undefined && !isValidIsoDate(date)) {
    return { error: "Event date must be a valid date in YYYY-MM-DD format." };
  }
  if (venue !== undefined && !venue) return { error: "Event venue cannot be empty." };

  if (input.capacity !== undefined) {
    const capacity = Number(input.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      return { error: "Event capacity must be a positive whole number." };
    }
  }

  for (const field of ["displayDate", "time", "description", "category"]) {
    if (input[field] !== undefined && typeof input[field] !== "string") {
      return { error: `${field} must be a string.` };
    }
  }

  if (!validateRegistrationPage(input.registrationPage)) {
    return { error: "registrationPage must be a safe relative .html path." };
  }

  const result = {};
  if (title !== undefined) result.title = title;
  if (date !== undefined) result.date = date;
  if (venue !== undefined) result.venue = venue;
  for (const field of ["displayDate", "time", "description", "category", "registrationPage"]) {
    if (input[field] !== undefined) result[field] = cleanString(input[field]);
  }
  if (input.capacity !== undefined) result.capacity = Number(input.capacity);

  if (creating) {
    result.displayDate = result.displayDate || result.date;
    result.time = result.time || "TBA";
    result.description = result.description || "";
    result.category = result.category || "General";
  }

  return { value: result };
};

const validateTeamMember = (input, { creating = false } = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Request body must be a JSON object." };
  }

  const name = input.name === undefined ? undefined : cleanString(input.name);
  const role = input.role === undefined ? undefined : cleanString(input.role);

  if (creating && (!name || !role)) {
    return { error: "Please provide team member name and role." };
  }
  if (name !== undefined && !name) return { error: "Team member name cannot be empty." };
  if (role !== undefined && !role) return { error: "Team member role cannot be empty." };

  for (const field of ["description", "image", "linkedin"]) {
    if (input[field] !== undefined && typeof input[field] !== "string") {
      return { error: `${field} must be a string.` };
    }
  }

  if (input.image !== undefined && input.image.trim()) {
    const imagePath = input.image.trim();
    if (
      imagePath.includes("..") ||
      !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:png|jpe?g|svg|webp|gif)$/i.test(imagePath)
    ) {
      return { error: "Image must be a relative image asset path (PNG, JPG, SVG, WEBP, or GIF)." };
    }
  }

  if (input.linkedin !== undefined && input.linkedin.trim()) {
    try {
      const url = new URL(input.linkedin.trim());
      if (url.protocol !== "https:" || !url.hostname.endsWith("linkedin.com")) {
        return { error: "LinkedIn URL must be a valid HTTPS linkedin.com address." };
      }
    } catch {
      return { error: "LinkedIn URL must be a valid HTTPS URL." };
    }
  }

  const result = {};
  if (name !== undefined) result.name = name;
  if (role !== undefined) result.role = role;
  for (const field of ["description", "image", "linkedin"]) {
    if (input[field] !== undefined) result[field] = cleanString(input[field]);
  }
  if (creating) {
    result.description = result.description || "";
    result.image = result.image || "";
  }

  return { value: result };
};

const sendServerError = (res, label, error, publicMessage) => {
  console.error(`${label}:`, error.message);
  return res.status(500).json({ success: false, message: publicMessage });
};

// GET /api/local-data/events
const getLocalEvents = async (req, res) => {
  try {
    const events = await readJsonArray(EVENTS_FILE_PATH);
    return res.status(200).json({ success: true, count: events.length, data: events });
  } catch (error) {
    return sendServerError(res, "Read events JSON error", error, "Unable to retrieve local events data.");
  }
};

// GET /api/local-data/events/:id
const getLocalEventById = async (req, res) => {
  try {
    const event = (await readJsonArray(EVENTS_FILE_PATH)).find((item) => item.id === req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }
    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    return sendServerError(res, "Read event by ID error", error, "Unable to retrieve local event details.");
  }
};

// POST /api/local-data/events (admin only)
const saveLocalEvent = async (req, res) => {
  const validation = validateEvent(req.body, { creating: true });
  if (validation.error) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  try {
    const created = await withWriteLock(async () => {
      const events = await readJsonArray(EVENTS_FILE_PATH);
      const id = req.body.id === undefined ? slugify(validation.value.title) : cleanString(req.body.id);

      if (!isValidId(id)) throw Object.assign(new Error("Event ID must use lowercase letters, numbers, and hyphens."), { statusCode: 400 });
      if (events.some((event) => event.id === id)) {
        throw Object.assign(new Error("An event with this ID already exists."), { statusCode: 409 });
      }

      const event = {
        id,
        ...validation.value,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      events.push(event);
      await writeJsonArray(EVENTS_FILE_PATH, events);
      return event;
    });

    return res.status(201).json({ success: true, message: "Event created successfully.", data: created });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return sendServerError(res, "Save event JSON error", error, "Unable to save event data.");
  }
};

// PUT /api/local-data/events/:id (admin only; ID is immutable)
const updateLocalEvent = async (req, res) => {
  if (req.body && req.body.id !== undefined && req.body.id !== req.params.id) {
    return res.status(400).json({ success: false, message: "Event ID cannot be changed." });
  }
  const validation = validateEvent(req.body);
  if (validation.error) return res.status(400).json({ success: false, message: validation.error });

  try {
    const updated = await withWriteLock(async () => {
      const events = await readJsonArray(EVENTS_FILE_PATH);
      const index = events.findIndex((event) => event.id === req.params.id);
      if (index === -1) return null;

      events[index] = {
        ...events[index],
        ...validation.value,
        updatedAt: new Date().toISOString()
      };
      await writeJsonArray(EVENTS_FILE_PATH, events);
      return events[index];
    });

    if (!updated) return res.status(404).json({ success: false, message: "Event not found." });
    return res.status(200).json({ success: true, message: "Event updated successfully.", data: updated });
  } catch (error) {
    return sendServerError(res, "Update event JSON error", error, "Unable to update event data.");
  }
};

// GET /api/local-data/team
const getLocalTeam = async (req, res) => {
  try {
    const team = await readJsonArray(TEAM_FILE_PATH);
    return res.status(200).json({ success: true, count: team.length, data: team });
  } catch (error) {
    return sendServerError(res, "Read team JSON error", error, "Unable to retrieve team members data.");
  }
};

// GET /api/local-data/team/:id
const getLocalTeamMemberById = async (req, res) => {
  try {
    const member = (await readJsonArray(TEAM_FILE_PATH)).find((item) => item.id === req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: "Team member not found." });
    }
    return res.status(200).json({ success: true, data: member });
  } catch (error) {
    return sendServerError(res, "Read team member by ID error", error, "Unable to retrieve team member details.");
  }
};

// POST /api/local-data/team (admin only)
const saveLocalTeamMember = async (req, res) => {
  const validation = validateTeamMember(req.body, { creating: true });
  if (validation.error) return res.status(400).json({ success: false, message: validation.error });

  try {
    const created = await withWriteLock(async () => {
      const team = await readJsonArray(TEAM_FILE_PATH);
      const id = req.body.id === undefined ? slugify(validation.value.name) : cleanString(req.body.id);
      if (!isValidId(id)) throw Object.assign(new Error("Member ID must use lowercase letters, numbers, and hyphens."), { statusCode: 400 });
      if (team.some((member) => member.id === id)) {
        throw Object.assign(new Error("A team member with this ID already exists."), { statusCode: 409 });
      }

      const member = {
        id,
        ...validation.value,
        ...(req.body.linkedin ? { linkedin: validation.value.linkedin } : {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      team.push(member);
      await writeJsonArray(TEAM_FILE_PATH, team);
      return member;
    });

    return res.status(201).json({ success: true, message: "Team member created successfully.", data: created });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return sendServerError(res, "Save team JSON error", error, "Unable to save team member data.");
  }
};

// PUT /api/local-data/team/:id (admin only; ID is immutable)
const updateLocalTeamMember = async (req, res) => {
  if (req.body && req.body.id !== undefined && req.body.id !== req.params.id) {
    return res.status(400).json({ success: false, message: "Member ID cannot be changed." });
  }
  const validation = validateTeamMember(req.body);
  if (validation.error) return res.status(400).json({ success: false, message: validation.error });

  try {
    const updated = await withWriteLock(async () => {
      const team = await readJsonArray(TEAM_FILE_PATH);
      const index = team.findIndex((member) => member.id === req.params.id);
      if (index === -1) return null;

      team[index] = {
        ...team[index],
        ...validation.value,
        updatedAt: new Date().toISOString()
      };
      await writeJsonArray(TEAM_FILE_PATH, team);
      return team[index];
    });

    if (!updated) return res.status(404).json({ success: false, message: "Team member not found." });
    return res.status(200).json({ success: true, message: "Team member updated successfully.", data: updated });
  } catch (error) {
    return sendServerError(res, "Update team JSON error", error, "Unable to update team member data.");
  }
};

module.exports = {
  getLocalEvents,
  getLocalEventById,
  saveLocalEvent,
  updateLocalEvent,
  getLocalTeam,
  getLocalTeamMemberById,
  saveLocalTeamMember,
  updateLocalTeamMember
};

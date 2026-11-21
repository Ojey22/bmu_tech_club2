const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const app = require("../src/app");
const User = require("../src/models/User");
const Registration = require("../src/models/Registration");
const localDataController = require("../src/controllers/localDataController");
const { getMyRegistrations } = require("../src/controllers/registrationController");

const dataDirectory = path.join(__dirname, "../src/data");
const eventsPath = path.join(dataDirectory, "events.json");
const teamPath = path.join(dataDirectory, "team.json");

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return response;
};

const invoke = async (handler, req = {}) => {
  const res = createResponse();
  await handler(req, res);
  return res;
};

test("public API routes return the JSON datasets and protect writes", async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once("listening", resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).success, true);

  const eventsResponse = await fetch(`${baseUrl}/api/local-data/events`);
  assert.equal(eventsResponse.status, 200);
  const events = await eventsResponse.json();
  assert.equal(events.count, 3);
  assert.ok(events.data.some((event) => event.id === "coding-challenge"));

  const oneEventResponse = await fetch(`${baseUrl}/api/local-data/events/ai-future-talk`);
  assert.equal(oneEventResponse.status, 200);
  assert.equal((await oneEventResponse.json()).data.title, "AI & Future Technology Talk");

  const teamResponse = await fetch(`${baseUrl}/api/local-data/team`);
  assert.equal(teamResponse.status, 200);
  const team = await teamResponse.json();
  assert.equal(team.count, 4);
  assert.ok(team.data.some((member) => member.id === "ojas-srivastava"));

  const oneMemberResponse = await fetch(`${baseUrl}/api/local-data/team/diya-dawra`);
  assert.equal(oneMemberResponse.status, 200);
  assert.equal((await oneMemberResponse.json()).data.role, "Club President");

  const protectedWrite = await fetch(`${baseUrl}/api/local-data/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "No Auth", date: "2026-12-10", venue: "Test" })
  });
  assert.equal(protectedWrite.status, 401);

  const protectedMyRegistrations = await fetch(`${baseUrl}/api/registrations/my`);
  assert.equal(protectedMyRegistrations.status, 401);
});

test("event and team JSON controllers validate, create, and update records", async () => {
  const originalEvents = await fs.readFile(eventsPath);
  const originalTeam = await fs.readFile(teamPath);

  try {
    const invalidEvent = await invoke(localDataController.saveLocalEvent, {
      body: { title: "Invalid Date", date: "tomorrow", venue: "Test Venue" }
    });
    assert.equal(invalidEvent.statusCode, 400);

    const createdEvent = await invoke(localDataController.saveLocalEvent, {
      body: {
        id: "smoke-test-event",
        title: "Smoke Test Event",
        date: "2026-12-10",
        venue: "Test Venue",
        registrationPage: "coding-register.html"
      }
    });
    assert.equal(createdEvent.statusCode, 201);
    assert.equal(createdEvent.body.data.id, "smoke-test-event");

    const updatedEvent = await invoke(localDataController.updateLocalEvent, {
      params: { id: "smoke-test-event" },
      body: { time: "2:00 PM - 3:00 PM" }
    });
    assert.equal(updatedEvent.statusCode, 200);
    assert.equal(updatedEvent.body.data.time, "2:00 PM - 3:00 PM");
    assert.equal(updatedEvent.body.data.title, "Smoke Test Event");

    const createdMember = await invoke(localDataController.saveLocalTeamMember, {
      body: {
        id: "smoke-test-member",
        name: "Smoke Test Member",
        role: "Test Coordinator",
        image: "Ojas.jpeg"
      }
    });
    assert.equal(createdMember.statusCode, 201);

    const updatedMember = await invoke(localDataController.updateLocalTeamMember, {
      params: { id: "smoke-test-member" },
      body: { description: "Updated during smoke test." }
    });
    assert.equal(updatedMember.statusCode, 200);
    assert.equal(updatedMember.body.data.description, "Updated during smoke test.");
  } finally {
    await fs.writeFile(eventsPath, originalEvents);
    await fs.writeFile(teamPath, originalTeam);
  }
});

test("My Registrations returns only the authenticated user's records and event metadata", async () => {
  const originalFindById = User.findById;
  const originalRegistrationFind = Registration.find;

  try {
    User.findById = () => ({
      select: async () => ({
        _id: "mock-user-id",
        fullName: "Test Student",
        enrollmentNumber: "TEST-001",
        email: "test@student.example"
      })
    });

    Registration.find = (query) => {
      assert.deepEqual(query, { userId: "mock-user-id" });
      return {
        sort: () => ({
          lean: async () => [{ _id: "mock-registration-id", eventName: "ai-future-talk" }]
        })
      };
    };

    const response = await invoke(getMyRegistrations, { userId: "mock-user-id" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.count, 1);
    assert.equal(response.body.student.enrollmentNumber, "TEST-001");
    assert.equal(response.body.data[0].eventDetails.title, "AI & Future Technology Talk");
    assert.equal(response.body.data[0].eventDetails.venue, "Auditorium");

    Registration.find = () => ({ sort: () => ({ lean: async () => [] }) });
    const emptyResponse = await invoke(getMyRegistrations, { userId: "mock-user-id" });
    assert.equal(emptyResponse.statusCode, 200);
    assert.equal(emptyResponse.body.count, 0);
    assert.deepEqual(emptyResponse.body.data, []);
  } finally {
    User.findById = originalFindById;
    Registration.find = originalRegistrationFind;
  }
});

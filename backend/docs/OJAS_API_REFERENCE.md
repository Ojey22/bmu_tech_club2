# BMU Tech Club — Ojas Backend API Reference

Base URL for local development: `http://localhost:5000`

The frontend loads `api-config.js` before its feature scripts. It uses `http://localhost:5000` on localhost/127.0.0.1 and the deployed Render API on other hosts; set `window.API_BASE_URL` before it loads to override this. The homepage's visual structure and CSS are unchanged. `local-data.js` reads the same event/team cards from the JSON APIs and reuses the existing CSS class names. If the backend is unavailable, the original static homepage markup remains visible.

## JSON file APIs

All read endpoints are public. All create/update endpoints require an administrator JWT:

`Authorization: Bearer <admin_token>`

### Events

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/local-data/events` | Public | Return every event in `src/data/events.json` |
| GET | `/api/local-data/events/:id` | Public | Return one event by stable ID |
| POST | `/api/local-data/events` | Admin | Add an event; ID is supplied or generated from title |
| PUT | `/api/local-data/events/:id` | Admin | Partially update an event; ID cannot be changed |

Example POST body:

```json
{
  "title": "Example Workshop",
  "date": "2026-12-10",
  "displayDate": "10 December",
  "time": "2:00 PM - 4:00 PM",
  "venue": "Venue confirmed by the club",
  "description": "Example description",
  "category": "Workshop",
  "registrationPage": "example-register.html"
}
```

`title`, `date` (valid `YYYY-MM-DD`), and `venue` are required. `capacity` is optional and, when supplied, must be a positive integer. The registration page must be a relative `.html` path. The sample body above is only a schema example, not a real club event.

### Team

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/local-data/team` | Public | Return every member in `src/data/team.json` |
| GET | `/api/local-data/team/:id` | Public | Return one member by stable ID |
| POST | `/api/local-data/team` | Admin | Add a team member; ID is supplied or generated from name |
| PUT | `/api/local-data/team/:id` | Admin | Partially update a team member; ID cannot be changed |

Example POST body:

```json
{
  "name": "Example Member",
  "role": "Technical Coordinator",
  "description": "Approved club role description",
  "image": "ExampleMember.jpeg",
  "linkedin": "https://www.linkedin.com/in/example/"
}
```

`name` and `role` are required. The image path must be relative to the frontend project and cannot contain traversal segments. LinkedIn, when provided, must use HTTPS and a `linkedin.com` host. The sample body is not an actual team record.

### Responses and error codes

Success responses use `{ "success": true, "data": ... }`; collection responses also include `count`. Validation errors return `400`, missing records `404`, duplicate IDs `409`, missing/invalid JWTs `401`, and authenticated non-admin writes `403`.

JSON writes are serialized within the running Node process and saved through a temporary file followed by rename, avoiding partially-written JSON files. Back up the JSON files before manual production edits.

## My Registrations (MongoDB remains source of truth)

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/registrations/my` | Authenticated student/admin | Return only registrations whose `userId` matches the verified JWT subject |

The route and JWT middleware already existed in the project. The controller now also resolves the active user from MongoDB and attaches matching event details from `events.json`. It does not read or write registrations from a JSON file and does not change the Mongoose schemas.

Example response shape:

```json
{
  "success": true,
  "count": 1,
  "student": {
    "fullName": "Student Name",
    "enrollmentNumber": "ENROLLMENT_NUMBER",
    "email": "student@example.edu"
  },
  "data": [
    {
      "_id": "MongoDB registration id",
      "eventName": "ai-future-talk",
      "eventDetails": {
        "id": "ai-future-talk",
        "title": "AI & Future Technology Talk",
        "date": "2026-09-22",
        "displayDate": "22 September",
        "time": "4:00 PM - 5:30 PM",
        "venue": "Auditorium",
        "category": "Talk",
        "registrationPage": "ai-talk-register.html"
      }
    }
  ]
}
```

When no registrations exist, `count` is `0` and `data` is `[]`. If an old registration no longer matches the event catalogue, `eventDetails` is `null` while the original MongoDB registration is still returned.

## Existing external API

`GET /api/external/github-stats` already fetches public repository metadata from GitHub. No additional external service was introduced because the existing feature is sufficient for the project's optional external-API demonstration.

## Run and test

```bash
cd backend
npm install
npm test
npm run dev
```

Set `MONGODB_URI` and a strong `JWT_SECRET` in `backend/.env` before starting the complete server. Do not commit `.env` or real tokens.

Import `postman/BMU-Tech-Club-Ojas-APIs.postman_collection.json` into Postman. Set `baseUrl`, `adminToken`, and `studentToken` collection variables before authenticated tests.

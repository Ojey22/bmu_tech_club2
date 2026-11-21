# BMU Tech Club — Profile Edit Fix

## What was fixed
- `profile.html` now sends edited profile fields to the backend using `PATCH /api/auth/profile`.
- The frontend displays the saved values returned by the API and updates `localStorage.currentUser`.
- `backend/src/controllers/authController.js` now validates and saves the allowed profile fields for the authenticated user.
- `backend/src/routes/authRoutes.js` mounts the protected PATCH endpoint using the existing JWT middleware.

## Editable fields
- Full name
- Phone number
- Course
- Year (1–5)
- Interests

Email, enrollment number, password, and role are not editable through this endpoint.

## Run locally
1. Open the `backend` folder in a terminal.
2. Create your own `backend/.env` using `.env.example` as a template. Do not commit or share `.env`.
3. Run `npm install` if dependencies are not installed.
4. Run `npm run dev`.
5. Serve the frontend using Live Server.
6. Sign in, open **My Profile**, edit a field, and click **Save Changes**.

## API test in Thunder Client
- Method: `PATCH`
- URL: `http://localhost:5000/api/auth/profile`
- Auth: Bearer Token — use your current login JWT
- Body: JSON

```json
{
  "fullName": "Updated Student Name",
  "phoneNumber": "9876543210",
  "course": "B.Tech CSE",
  "year": "2",
  "interest": "Web development, backend"
}
```

Expected response: `200 OK` with `success: true` and the updated `data` object.

The project archive intentionally excludes `backend/.env` and `node_modules`. Keep your existing local `.env` file; do not replace it with a shared credentials file.

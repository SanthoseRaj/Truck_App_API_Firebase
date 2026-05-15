# EGASohar_API

Backend API for a Truck Tracking and Destination Management App built with Node.js, Express, MongoDB, Mongoose, JWT authentication, bcrypt password hashing, and Swagger UI.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file from `.env.example`:

```env
PORT=5000
MONGO_URI=mongodb+srv://egasohar_db_user:DbIMQ0GFUfX6a0lf@egasohar.ojzyfsj.mongodb.net/?appName=EGASohar
JWT_SECRET=truck_tracking_super_secret_key
JWT_EXPIRES_IN=7d
```

3. Start the development server:

```bash
npm run dev
```

Server URL: `http://localhost:5000`

Swagger URL: `http://localhost:5000/api-docs`

## Default Users

These users are seeded automatically on server start if they do not already exist. All default passwords are `123456`.

| Username | Role |
| --- | --- |
| owner | owner |
| admin | admin |
| yard | yard |
| gate | gate |
| port | port |
| clearence | clearence |
| dubai | dubai |

## API Groups

- `POST /api/auth/login`
- `GET /api/auth/profile`
- `GET /api/auth/entry-teams`
- `POST /api/auth/admins`
- `POST /api/auth/members`
- `GET /api/auth/members`
- `GET /api/auth/members/:id`
- `PUT /api/auth/members/:id`
- `DELETE /api/auth/members/:id`
- `GET /api/drivers`
- `GET /api/drivers/:id`
- `POST /api/drivers`
- `PUT /api/drivers/:id`
- `DELETE /api/drivers/:id`
- `POST /api/trucks`
- `GET /api/trucks`
- `GET /api/trucks/:id`
- `PUT /api/trucks/:id`
- `DELETE /api/trucks/:id`
- `GET /api/trucks/number/:truckNumber`
- `POST /api/trips/:truckId/entry`
- `POST /api/trips/:truckId/exit`
- `POST /api/trips/:truckId/move-next`
- `GET /api/trips/:truckId/history`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/map`
- `GET /api/dashboard/route/:from/:to`

## Stops

1. Yard
2. Gate
3. Port Loading
4. Custom Clearence
5. Dubai / Free Zone

## Notes

- Credentials are never hardcoded. Set `MONGO_URI` in `.env`.
- Default user passwords are hashed with bcrypt before storage.
- Truck deletion is a soft delete using `isActive: false`.
- When Yard or Admin creates a truck with an existing `truckNumber`, the existing truck is reused, `tripCount` increments, and a new trip record is created.

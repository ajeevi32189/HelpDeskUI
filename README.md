# Ajeevi HelpDesk UI

Vite + React + TypeScript frontend scaffold for Ajeevi HelpDesk.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Open a terminal in this folder.
3. Run:

```bash
npm install
npm run dev
```

4. Open the URL Vite prints (usually http://localhost:5173).

## Included
- Login page with API-backed captcha rendering and light/dark theme toggle
- Protected routes and token storage/refresh interceptor
- Responsive sidebar layout
- Tickets list with search, filters, pagination, status/priority/severity/SLA badges
- Ticket create and edit forms, detail view, assignment/audit history, and workflow actions
- Ticket attachments, including upload and download
- Admin CRUD pages for SLA policies, escalation levels, email templates, and work-order templates
- User directory and read-only role assignment summary
- Work-order template ticket creation and server-generated SLA report export
- Reports screen with SLA summary, ticket/work-order filters, priority breakdown, and CSV export (based on the first 100 tickets returned by the API)
- Ticket delete UI uses the conventional `DELETE /api/tickets/{id}` route; confirm this route exists in the live Swagger before relying on it
- Dashboard, Reports, attachment upload/download, and Admin management screens still need their API contracts and implementation

## API configuration
Development proxy paths are configured in `vite.config.ts`:
- `/auth-api` -> `https://usermanagementms.ajeevi.in`
- `/ticket-api` -> `https://ticketmanagementms.ajeevi.in`
- `/device-api` -> `https://devicemanagementms.ajeevi.in`

For production builds, set `VITE_AUTH_API_URL`, `VITE_TICKET_API_URL`, and `VITE_DEVICE_API_URL` as appropriate. The backend must permit browser requests in production.

## Important
The API response shape and JWT claims were inferred from the supplied notes and should be verified against live Swagger/API responses. The SLA field currently requires an SLA ID, and assignment uses an entered account ID/email until a user-directory API is confirmed. Do not put secrets in frontend environment variables. A frontend captcha rendering the API-provided answer is presentation only; CAPTCHA validation must be enforced securely on the server.

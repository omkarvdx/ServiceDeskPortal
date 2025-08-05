# API

Documentation for the backend API endpoints.

## Bulk Ticket Upload

`POST /api/tickets/bulk-upload/`

Upload a CSV file using `multipart/form-data` with field name `file` to create
multiple tickets at once. The CSV must include `summary`, `description` and
`created_by` columns (username of the ticket creator).

### CSRF protection

This endpoint is protected by Django's CSRF middleware. Before making a `POST`
request, fetch a CSRF token from `/api/auth/csrf/` and include it in the
`X-CSRFToken` header together with the session cookie. Requests without a valid
token will be rejected with `403 Forbidden`.

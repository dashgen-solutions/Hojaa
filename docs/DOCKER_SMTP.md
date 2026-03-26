# SMTP email in Docker

Document share emails use the same SMTP settings as the rest of the API. The backend container must receive `SMTP_*` environment variables.

## Root `docker-compose.yml` (recommended)

1. In the **repository root** (same folder as `docker-compose.yml`), create or edit **`.env`**.
2. Add your mail settings (see `.env.example`). Example for **Gmail** (app password):

   ```env
   SMTP_ENABLED=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=you@gmail.com
   SMTP_PASSWORD="your 16 char app password"
   SMTP_FROM_EMAIL=you@gmail.com
   SMTP_FROM_NAME=Hojaa
   SMTP_USE_TLS=true
   ```

   **Quote** `SMTP_PASSWORD` if it contains spaces (Docker Compose splits unquoted values on spaces).

3. Recreate the API container so it picks up changes:

   ```bash
   docker compose up -d --build api
   ```

4. Confirm variables are inside the container:

   ```bash
   docker exec hojaa-api env | findstr SMTP
   ```

   On Linux/macOS: `docker exec hojaa-api env | grep SMTP`

## `backend/docker-compose.yml`

Run Compose **from the `backend/` directory** so it reads **`backend/.env`** automatically for `${SMTP_*}` substitution:

```bash
cd backend
docker compose up -d --build
```

Put the same `SMTP_*` keys in `backend/.env`.

## Troubleshooting

- **`SMTP_USE_TLS`**: For port **587** (Gmail/Outlook), use `SMTP_USE_TLS=true`. For port **465** with implicit SSL (many hosts), use `SMTP_USE_TLS=false`.
- If email still fails, use **Send** on a document again and read **`smtp_error_detail`** in the UI, or check API logs.

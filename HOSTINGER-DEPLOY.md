# Deploying Nagrek on Hostinger

Nagrek is a **Node.js app** (Next.js + Socket.io in one process, `server.js`).
It needs a Hostinger plan with **Node.js Web Apps** (Business / Cloud) or a **VPS**.
Plain static/PHP shared hosting cannot run it (no WebSockets / Node process).

## Option A — hPanel "Node.js Web App" (easiest)

1. hPanel → **Websites → Add website → Node.js Apps** (or *Deploy Node.js app*).
2. Choose **Upload files** and upload this ZIP.
3. Build settings:
   | Setting          | Value            |
   |------------------|------------------|
   | Node.js version  | **20.x or 22.x** |
   | Package manager  | npm              |
   | Install command  | `npm install`    |
   | Build command    | `npm run build`  |
   | Start command    | `npm start`      |
   | Entry file       | `server.js`      |
   | Output directory | leave empty      |
4. Add environment variables from `.env.example`. **TURN is required in production**
   (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`). Optional: `CLIENT_ORIGIN`.
   Do **not** set `PORT` — Hostinger injects it.
5. Deploy, then attach your domain and enable the free **SSL** certificate.
   HTTPS is required: browsers only allow camera/microphone on `https://`.

## Option B — Hostinger VPS (Ubuntu)

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs unzip nginx
sudo npm i -g pm2

# Upload your project files to /var/www/nagrek (scp, rsync, or git clone)
cd /var/www/nagrek
npm install
npm run build
PORT=3000 pm2 start server.js --name nagrek
pm2 save && pm2 startup
```

Nginx reverse proxy (`/etc/nginx/sites-available/nagrek`) — the `Upgrade`
headers are required for Socket.io WebSockets:

```nginx
server {
  server_name yourdomain.com www.yourdomain.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nagrek /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx
```

## Coturn (TURN server) Setup on Ubuntu VPS

WebRTC P2P calls frequently fail across different mobile network carriers (NAT/firewall traversal). A TURN server relays the media when direct P2P fails:

1. Install coturn:
   ```bash
   sudo apt update && sudo apt install -y coturn
   ```
2. Enable coturn service:
   Edit `/etc/default/coturn` and set:
   ```
   TURNSERVER_ENABLED=1
   ```
3. Configure `/etc/turnserver.conf`:
   ```conf
   listening-port=3478
   tls-listening-port=5349
   realm=yourdomain.com
   fingerprint
   lt-cred-mech
   user=nagrekuser:yoursecurepassword
   total-quota=100
   stale-nonce
   no-loopback-peers
   no-multicast-peers
   ```
4. Restart and enable the service:
   ```bash
   sudo systemctl restart coturn
   sudo systemctl enable coturn
   ```
5. Open firewall ports:
   ```bash
   sudo ufw allow 3478/tcp
   sudo ufw allow 3478/udp
   sudo ufw allow 5349/tcp
   sudo ufw allow 5349/udp
   sudo ufw allow 49152:65535/udp
   ```
6. Set credentials in `.env`:
   ```env
   TURN_URL=turn:yourdomain.com:3478?transport=udp,turns:yourdomain.com:5349
   TURN_USERNAME=nagrekuser
   TURN_CREDENTIAL=yoursecurepassword
   ```

## Environment variables (Hostinger hPanel → Node.js → Environment)

Set these by name in the host dashboard (never commit secrets). Enter values yourself — do not paste into chat.

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes for auth | Public project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes for auth | Anon key (RLS protected) |
| `SUPABASE_URL` | Yes for server | Same URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for server | Server only — never expose to client |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | Strongly recommended | Without TURN, many mobile calls fail |
| `CLIENT_ORIGIN` | Optional | Comma-separated allowed Socket origins |
| `NAGREK_SKIP_PAYWALL` | Optional | Set `1` to skip paywall even if Razorpay keys exist |
| `NEXT_PUBLIC_NAGREK_SKIP_PAYWALL` | Optional | Client-side mirror of the bypass |
| `RAZORPAY_*` | Payment only | Leave unset to auto-bypass paywall until billing is live |

Do **not** set `PORT` on Hostinger — the platform injects it.

Apply SQL under `supabase/migrations/` in the Supabase SQL editor after owner approves **GATE-G1**.

## Notes

- `node server.js` always runs in **production** mode unless `NODE_ENV=development`.
- Matchmaking queues are in memory: run **one** instance (no PM2 cluster mode).
- Matching prefers coarse GPS **cell** (~10 km), then widens to **region** after ~20s.
- For users behind strict NATs / mobile networks, add a TURN server
  (coturn on the VPS, or Metered / Twilio / Cloudflare Calls) via `TURN_*`.
  Without TURN, many mobile-data calls will never connect. Spending on a paid TURN service needs **GATE-G9**.
- Do not cut over `nagrek.com` or write Hostinger secrets without **GATE-G3 / G4 / G10**.
- Local development: `npm install && npm run dev` → http://localhost:3000
  (`npm run dev` works on Windows; it starts `node server.js --dev`).
- Staging smoke: HTTPS, two phones, camera, match, report/block, friends request.

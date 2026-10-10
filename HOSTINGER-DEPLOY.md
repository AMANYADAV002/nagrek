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
4. (Optional) add environment variables from `.env.example`
   (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`, `CLIENT_ORIGIN`).
   Do **not** set `PORT` — Hostinger injects it.
5. Deploy, then attach your domain and enable the free **SSL** certificate.
   HTTPS is required: browsers only allow camera/microphone on `https://`.

## Option B — Hostinger VPS (Ubuntu)

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs unzip nginx
sudo npm i -g pm2

unzip nagrek-hostinger.zip -d /var/www && cd /var/www/nagrek
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

## Notes

- `node server.js` always runs in **production** mode unless `NODE_ENV=development`.
- Matchmaking queues are in memory: run **one** instance (no PM2 cluster mode).
- For users behind strict NATs / mobile networks, add a TURN server
  (e.g. coturn on the VPS, or a hosted one) via the `TURN_*` variables.
- Local development: `npm install && npm run dev` → http://localhost:3000

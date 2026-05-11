# Optima DigitalOcean Deployment

Target:
- Droplet: `159.89.196.24`
- User: `itsadamnshame`
- Domain: `metatech.live`
- App path used by these configs: `/home/itsadamnshame/Optima`

## 1. Regain Droplet Access

Because the original local SSH private key is unavailable, use one of these DigitalOcean paths:

- Add a new SSH key in the DigitalOcean dashboard, then use the Droplet web console to append its public key to `/home/itsadamnshame/.ssh/authorized_keys`.
- If password login is available, reset the droplet password in DigitalOcean and SSH with `ssh itsadamnshame@159.89.196.24`, then add a new SSH key.
- If you cannot log in as `itsadamnshame`, use the DigitalOcean recovery console as `root`, then add a new key for the user.
- If `chown itsadamnshame:itsadamnshame` fails with `invalid user`, create the user first with `adduser itsadamnshame` and `usermod -aG sudo itsadamnshame`, or use the actual username shown by `ls /home`.

On this computer, create a replacement key:

```bash
ssh-keygen -t ed25519 -C "optima-deploy" -f ~/.ssh/optima_do
ssh -i ~/.ssh/optima_do itsadamnshame@159.89.196.24
```

## 2. Install Server Packages

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nodejs npm postgresql postgresql-contrib nginx certbot python3-certbot-nginx
```

For heavier forecasting libraries, a droplet with at least 2 GB RAM is recommended; 4 GB is more comfortable.

## 3. PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE optima;
CREATE USER optima WITH PASSWORD 'change-this-password';
GRANT ALL PRIVILEGES ON DATABASE optima TO optima;
\c optima
GRANT ALL ON SCHEMA public TO optima;
\q
```

## 4. App Setup

Clone or upload the repo to `/home/itsadamnshame/Optima`, then:

```bash
cd /home/itsadamnshame/Optima/backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

cd /home/itsadamnshame/Optima/frontend
npm ci
npm run build
```

Create the production env file:

```bash
sudo mkdir -p /etc/optima
sudo nano /etc/optima/backend.env
sudo chmod 600 /etc/optima/backend.env
sudo chown root:root /etc/optima/backend.env
```

Use the values from `backend/.env.example`, with real passwords/secrets.

## 5. systemd and Nginx

```bash
sudo cp /home/itsadamnshame/Optima/deploy/optima-backend.service /etc/systemd/system/optima-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now optima-backend
sudo systemctl status optima-backend

sudo cp /home/itsadamnshame/Optima/deploy/nginx-metatech.live.conf /etc/nginx/sites-available/metatech.live
sudo ln -s /etc/nginx/sites-available/metatech.live /etc/nginx/sites-enabled/metatech.live
sudo nginx -t
sudo systemctl reload nginx
```

## 6. DNS and HTTPS

Point these DNS records to `159.89.196.24`:

- `A metatech.live`
- `A www.metatech.live`

After DNS resolves:

```bash
sudo certbot --nginx -d metatech.live -d www.metatech.live
```

## 7. Useful Commands

```bash
sudo journalctl -u optima-backend -f
sudo systemctl restart optima-backend
sudo nginx -t
curl http://127.0.0.1:8000/docs
```

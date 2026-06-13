Proceeding with HTTPS now: I’ll add Nginx TLS + ACME challenge support and update your production compose stack with a Certbot service so certificates for wa.austriabot.app can be issued and renewed.

I’m implementing a safe two-phase HTTPS flow now: bootstrap HTTP for certificate issuance, then switch to TLS config without downtime to backend services.

I’ve finished the TLS wiring in the repo. I’ll quickly validate the production compose renders correctly with the new nginx-config variable and certbot volumes.

Done. HTTPS support is now wired in your project with a safe bootstrap flow.

Updated files:

docker-compose.prod.yml
nginx.prod.conf
nginx.prod.tls.conf
.env.production.example
What this gives you:

Bootstrap mode on HTTP for Let’s Encrypt challenge
TLS mode config ready for wa.austriabot.app
Certbot service + shared volumes for certificate issue/renew
Gateway supports both port 80 and 443
Deploy steps on droplet:

Pull latest code
cd /opt/wa-group-scheduler
git pull origin main

Prepare env
cp -n .env.production.example .env.production
nano .env.production

In .env.production set at least:
DOMAIN=wa.austriabot.app
LETSENCRYPT_EMAIL=your-real-email@domain.com
NGINX_CONF=nginx.prod.conf
CLIENT_URL=http://wa.austriabot.app
DATABASE_URL=postgresql://wa:YOUR_PASSWORD@postgres:5432/whatsapp_scheduler
REDIS_URL=redis://redis:6379
plus your JWT and Cloudinary secrets

Start stack in bootstrap mode
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

Issue certificate
docker compose --env-file .env.production --profile ops -f docker-compose.prod.yml run --rm certbot certonly --webroot -w /var/www/certbot -d wa.austriabot.app --email your-real-email@domain.com --agree-tos --no-eff-email

Switch to TLS config
edit .env.production and change:
NGINX_CONF=nginx.prod.tls.conf
CLIENT_URL=https://wa.austriabot.app

Recreate gateway with TLS config
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate gateway backend

Verify
docker compose --env-file .env.production -f docker-compose.prod.yml ps
open https://wa.austriabot.app

Renewal command (run monthly via cron):
docker compose --env-file /opt/wa-group-scheduler/.env.production --profile ops -f /opt/wa-group-scheduler/docker-compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot ; docker compose --env-file /opt/wa-group-scheduler/.env.production -f /opt/wa-group-scheduler/docker-compose.prod.yml exec gateway nginx -s reload

Also make sure your droplet firewall allows 80 and 443.

1. log into droplet
2. cd /opt/wa-group-scheduler/
3. git pull
4. docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

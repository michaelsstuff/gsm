# Troubleshooting

## Common Issues

**"MONGO_PASSWORD must be set"**
```bash
export MONGO_PASSWORD=$(openssl rand -hex 24)
export SESSION_SECRET=$(openssl rand -hex 48)
export JWT_SECRET=$(openssl rand -hex 48)
```

**NPM not accessible on port 81**
- Check port usage: `sudo netstat -tlnp | grep :81`
- Check logs: `docker compose logs nginx-proxy-manager`

**NPM proxy host not working for local testing**
- When configuring a proxy host in NPM, use `127.0.0.1` instead of `localhost` as the forward hostname - localhost may not resolve correctly inside the container

**SSL certificate fails**
- Verify DNS points to server
- Ensure ports 80/443 open
- For Cloudflare, use DNS challenge in NPM

**Backend can't connect to MongoDB**
- Verify `MONGO_PASSWORD` is set
- Check logs: `docker compose logs mongodb`

**Game server management not working**
- Verify socket mount: `docker inspect gsm-backend | grep docker.sock`
- Check containers exist: `docker ps -a`
- Verify volume paths match your setup

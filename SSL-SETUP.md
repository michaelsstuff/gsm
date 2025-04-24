# SSL Certificate Setup Guide

This guide explains how to set up SSL certificates for your Game Server Manager deployment.

## Option 1: Let's Encrypt with HTTP Validation (Automatic)

The simplest method is to use Let's Encrypt to automatically obtain and renew SSL certificates:

1. Make sure your domain is properly configured to point to your server
2. Run the initialization script:

```bash
./init-letsencrypt.sh
```

This will:
- Configure a temporary nginx container
- Obtain certificates from Let's Encrypt
- Set up auto-renewal

## Option 2: Let's Encrypt with Cloudflare DNS Validation (Recommended)

If you're using Cloudflare as your DNS provider, you can use DNS validation instead of HTTP validation, which is more secure and works even if port 80 is blocked:

1. Make sure your domain is properly configured in Cloudflare
2. Set up your Cloudflare credentials in the `.env` file:
   ```
   CLOUDFLARE_EMAIL=your@email.com
   CLOUDFLARE_API_KEY=your_cloudflare_api_key
   ```
   You can find your API Key in the Cloudflare dashboard under "My Profile" > "API Tokens" > "Global API Key"

3. Run the command:
   ```bash
   ./docker-deploy.sh letsencrypt-cloudflare
   ```
   
The script will:
- Create a DNS TXT record to verify domain ownership
- Obtain certificates from Let's Encrypt
- Set up auto-renewal (certificates will renew automatically)

## Option 3: Custom SSL Certificates

If you already have your own SSL certificates:

1. Have your fullchain certificate (cert + intermediate certs) and private key ready
2. Run the command:

```bash
./docker-deploy.sh custom-ssl path/to/fullchain.pem path/to/privkey.pem
```

## Certificate Location

All certificates are stored in the `./data/certbot/conf/live/your-domain/` directory, with the following files:
- `fullchain.pem`: Your certificate including the full chain
- `privkey.pem`: Your private key

## Troubleshooting

If you encounter issues:

1. Check that your domain correctly points to your server
2. If using Cloudflare, ensure your API key has adequate permissions
3. Check the logs for more details: `docker-compose logs frontend`
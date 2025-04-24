# Custom SSL Certificate Setup Guide

This guide explains how to set up custom SSL certificates for your Game Server Manager application, especially when using Cloudflare as a proxy.

## Using Cloudflare Origin Certificates (Recommended)

1. Log in to your Cloudflare dashboard
2. Go to SSL/TLS > Origin Server
3. Click "Create Certificate"
4. Select the following options:
   - Hostnames: Your domain (e.g., `yourdomain.com`)
   - Key type: RSA
   - Certificate validity: 15 years (or your preference)
5. Click "Create"
6. Cloudflare will generate two files:
   - Origin Certificate (PEM format)
   - Private Key (PEM format)
7. Save both files to your server (e.g., as `cloudflare-cert.pem` and `cloudflare-key.pem`)
8. Install the certificates using:
   ```
   ./docker-deploy.sh custom-ssl cloudflare-cert.pem cloudflare-key.pem
   ```

## Using Your Own Custom Certificates

If you have your own certificates (from another CA):

1. Copy your certificate files to the server:
   - The full certificate chain (often named `fullchain.pem`)
   - The private key (often named `privkey.pem`)
2. Install them using:
   ```
   ./docker-deploy.sh custom-ssl /path/to/fullchain.pem /path/to/privkey.pem
   ```

## Cloudflare SSL/TLS Settings

For optimal security when using Cloudflare:

1. In your Cloudflare dashboard, go to SSL/TLS > Overview
2. Set SSL/TLS encryption mode to "Full (strict)"
3. This ensures traffic is encrypted both between:
   - Visitors and Cloudflare
   - Cloudflare and your origin server

## Renewal

Custom certificates don't auto-renew like Let's Encrypt certificates. If you're using Cloudflare Origin Certificates with the default 15-year expiry, you won't need to renew often. When you do need to renew:

1. Obtain new certificate files
2. Run the `custom-ssl` command again with the new certificate paths

## Troubleshooting

If you encounter SSL issues:

1. Check your Cloudflare SSL/TLS settings
2. Verify the certificates are properly installed:
   ```
   docker-compose exec frontend ls -la /etc/letsencrypt/live/yourdomain.com
   ```
3. Inspect the nginx logs:
   ```
   docker-compose logs frontend
   ```
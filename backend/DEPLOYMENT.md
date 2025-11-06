# Deployment Guide

## Cloud (SaaS) Deployment
### Prerequisites
- Container-ready environment (Docker Engine 24+, Docker Compose V2)
- Managed MongoDB instance or Atlas cluster
- SMTP account for notification emails
- DNS entry (e.g. `qdms.company.com`) pointing to load balancer

### Steps
1. Clone the repository and copy `.env.example` to `.env`. Fill in JWT secret, SMTP credentials and Mongo connection string.
2. Update `docker-compose.yml` with Mongo connection, external port and image repository if pushing to a registry.
3. Build and publish the backend and frontend images:
   ```
   docker compose build
   docker tag backend your-registry/qdms-backend:latest
   docker tag frontend your-registry/qdms-frontend:latest
   docker push your-registry/qdms-backend:latest
   docker push your-registry/qdms-frontend:latest
   ```
4. On the cloud host, pull the images and run `docker compose up -d`.
5. Configure reverse proxy or ingress (Nginx, ALB, Traefik) to expose the frontend and proxy `/api` requests to the backend container (default port 8001).
6. Set up TLS certificates (Let’s Encrypt or managed certificates) and enforce HTTPS.

### Post Deployment Checklist
- Create first admin user via `/api/init/admin`.
- Configure SMTP or notification integration.
- Create base roles and permissions (`admin.roles.manage` etc.).
- Seed folders and module configuration through admin UI.

## On-Premise Deployment
### Prerequisites
- Ubuntu Server 22.04 LTS (or equivalent) with root/ sudo access
- Docker Engine 24+ and Docker Compose V2 installed
- Internal DNS record and TLS certificate (optional but recommended)
- Access to company SMTP server

### Steps
1. **Install Docker Engine**
   ```
   sudo apt-get update
   sudo apt-get install ca-certificates curl gnupg
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker.gpg
   echo \
     "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
     $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt-get update
   sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```
2. **Clone the repository**
   ```
   git clone https://your.git.server/qdms.git
   cd qdms/app
   cp backend/.env.example backend/.env
   ```
3. **Prepare environment**
   - Edit `backend/.env` with Mongo URL, SMTP credentials, JWT secret, etc.
   - For single-server deployments run bundled Mongo via `docker-compose.yml`. For HA use external Mongo.
4. **Start services**
   ```
   docker compose pull   # pull latest images if available
   docker compose up -d
   ```
5. **Firewall / Reverse Proxy**
   - Allow inbound traffic on chosen HTTP/HTTPS ports (e.g. 80/443).
   - Optionally place behind existing reverse proxy; proxy `/api` to backend (`localhost:8001` by default).
6. **Systemd Service (optional)**
   - Create `/etc/systemd/system/qdms.service`:
     ```
     [Unit]
     Description=QDMS Stack
     Requires=docker.service
     After=docker.service

     [Service]
     Type=oneshot
     WorkingDirectory=/opt/qdms/app
     ExecStart=/usr/bin/docker compose up -d
     ExecStop=/usr/bin/docker compose down
     RemainAfterExit=yes

     [Install]
     WantedBy=multi-user.target
     ```
   - Reload and enable: `sudo systemctl daemon-reload && sudo systemctl enable --now qdms`

## Verification
- Access frontend URL and ensure login page is served.
- Call `/api/health` (implement as needed) or `/api/auth/login` to confirm API reachability.
- In admin UI, create base roles and assign users.
- Run sample document upload and approval flow to confirm SMTP notifications.

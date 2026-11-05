#!/usr/bin/env bash
# Déploie BEYBOO sur un VPS Ubuntu (accès SSH root par clé) : Node 22, Caddy (HTTPS), service systemd.
# Usage : scripts/deploy-vps.sh root@2.24.58.57 [chemin du .env à installer la première fois]
# Idempotent : relancer après chaque modification du code.
set -euo pipefail
TARGET="${1:?Usage: $0 user@hote [fichier.env]}"
ENV_SRC="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP=/opt/beyboo

echo "→ Copie du code vers $TARGET:$APP"
ssh "$TARGET" "mkdir -p $APP"
rsync -az --delete \
  --exclude '.git' --exclude 'node_modules' --exclude 'server/node_modules' --exclude 'dist-pages' \
  --exclude '.env' --exclude '.env.*' --exclude '.dev.vars' --exclude 'data' --exclude '.wrangler' --exclude '.DS_Store' \
  "$ROOT/" "$TARGET:$APP/"
if [ -n "$ENV_SRC" ]; then
  echo "→ Installation du fichier .env"
  scp -q "$ENV_SRC" "$TARGET:$APP/.env"
fi

echo "→ Installation sur le serveur"
ssh "$TARGET" bash -s <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
APP=/opt/beyboo
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)'; then
  echo "  · Node.js 22 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y nodejs >/dev/null
fi
if ! command -v caddy >/dev/null; then
  echo "  · Caddy"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update >/dev/null && apt-get install -y caddy >/dev/null
fi
id beyboo >/dev/null 2>&1 || useradd --system --home-dir /var/lib/beyboo --shell /usr/sbin/nologin beyboo
mkdir -p /var/lib/beyboo && chown -R beyboo:beyboo /var/lib/beyboo
cd $APP/server && npm install --omit=dev --no-audit --no-fund >/dev/null
if [ ! -f $APP/.env ]; then
  echo "  · .env absent : génération d'un code famille et des secrets"
  gen() { node -e "console.log(require('crypto').randomBytes($1).toString('base64url'))"; }
  cat > $APP/.env <<ENV
AUTH_MODE=password
SITE_PASSWORD=beyboo-$(gen 4)
AUTH_SECRET=$(gen 32)
SESSION_SIGNING_SECRET=$(gen 32)
CSP_MODE=report
SITE_URL=https://$(hostname -f)
# OPENAI_API_KEY=       (voix)
# YOUTUBE_DATA_API_KEY= (recherche YouTube complète ; sans clé : flux de chaînes sélectionnées)
# TURN_KEY_ID= / TURN_KEY_API_TOKEN= (Cloudflare Realtime TURN, appels entre réseaux difficiles)
ENV
fi
chown root:beyboo $APP/.env && chmod 640 $APP/.env
chown -R root:beyboo $APP && chmod -R o-rwx $APP
install -m 644 $APP/server/beyboo.service /etc/systemd/system/beyboo.service
install -m 644 $APP/server/Caddyfile /etc/caddy/Caddyfile
if command -v ufw >/dev/null; then ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw --force enable >/dev/null; fi
systemctl daemon-reload
systemctl enable --now beyboo >/dev/null
systemctl restart beyboo
systemctl enable --now caddy >/dev/null
caddy validate --config /etc/caddy/Caddyfile >/dev/null && systemctl reload caddy
sleep 2
systemctl is-active beyboo caddy
curl -fsS http://127.0.0.1:8080/api/health; echo
echo "  · code famille : voir $APP/.env (SITE_PASSWORD)"
REMOTE
echo "✓ Déploiement terminé : https://$(ssh "$TARGET" hostname -f)/index.html?app=1"

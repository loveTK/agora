#!/usr/bin/env bash
# AWS Lightsail (Ubuntu 22.04) 최초 1회 서버 셋업 스크립트.
# Lightsail 콘솔에서 인스턴스 생성 후, SSH 접속하여 이 스크립트를 실행한다.
#   curl -fsSL https://raw.githubusercontent.com/<owner>/agora/main/deploy/setup.sh | bash
# 또는 리포를 clone한 뒤 bash deploy/setup.sh 로 직접 실행해도 된다.
set -euo pipefail

APP_DIR="/home/ubuntu/agora"
REPO_URL="${REPO_URL:-https://github.com/lovetk/agora.git}"
BRANCH="${BRANCH:-main}"

echo "== 1. 시스템 패키지 업데이트 =="
sudo apt-get update -y
sudo apt-get upgrade -y

echo "== 2. Node.js 22 LTS 설치 =="
# better-sqlite3 최신 버전이 Node >=22를 요구함(그 미만이면 DB 여는 순간 세그폴트 발생).
NODE_MAJOR="$(command -v node >/dev/null 2>&1 && node -e 'console.log(process.versions.node.split(".")[0])' || echo 0)"
if [ "$NODE_MAJOR" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "== 3. better-sqlite3 네이티브 빌드 도구 설치 =="
sudo apt-get install -y build-essential python3 git nginx

echo "== 4. PM2 설치 =="
sudo npm install -g pm2

echo "== 5. 애플리케이션 배포 =="
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
npm ci --omit=dev

mkdir -p "$APP_DIR/data"
if [ ! -f "$APP_DIR/.env" ]; then
  cp .env.example .env
  # DB는 인스턴스의 영구 SSD(EBS 아님, Lightsail 기본 스토리지)에 저장됨 — Render 무료 티어와 달리 재시작해도 유지된다.
  sed -i "s#^DB_PATH=.*#DB_PATH=$APP_DIR/data/agora.db#" .env
  echo ">>> .env 생성됨. JWT_SECRET / ADMIN_TOKEN 값을 반드시 실제 운영 값으로 교체할 것: $APP_DIR/.env"
fi

npm run seed || true   # 이미 시드된 경우 실패해도 무시 (seedIfEmpty가 기동 시 재확인)

echo "== 6. PM2로 앱 기동 및 부팅 시 자동 시작 등록 =="
pm2 start ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "== 7. Nginx 리버스 프록시 설정 =="
sudo cp deploy/nginx.conf /etc/nginx/sites-available/agora
sudo ln -sf /etc/nginx/sites-available/agora /etc/nginx/sites-enabled/agora
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "== 완료 =="
echo "다음 단계:"
echo "1) $APP_DIR/.env 의 JWT_SECRET / ADMIN_TOKEN 교체 후: pm2 restart agora-api"
echo "2) 도메인 연결 후 HTTPS 발급: sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d <도메인>"
echo "3) Lightsail 콘솔 방화벽에서 80/443만 공개, 4000은 막아둘 것(Nginx를 통해서만 접근)"

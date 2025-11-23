#!/bin/bash
# Valorie Framework 域名迁移部署脚本

set -e

echo "🚀 Starting deployment..."

# 安装 Nginx
echo "📦 Installing Nginx..."
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# 配置 Nginx
echo "⚙️  Configuring Nginx..."
sudo cp nginx-valorie.conf /etc/nginx/sites-available/valorie
sudo ln -sf /etc/nginx/sites-available/valorie /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

echo ""
echo "✅ Nginx configured successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Make sure DNS is configured (expert.valorie.ai and *.valorie.ai)"
echo "2. Get SSL certificates:"
echo "   sudo certbot --nginx -d expert.valorie.ai"
echo "   sudo certbot certonly --manual --preferred-challenges dns -d '*.valorie.ai' -d valorie.ai"
echo "3. Open ports 80 and 443 in GCP firewall"
echo "4. Update frontend code and rebuild Docker"
echo ""
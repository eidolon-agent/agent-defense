mkdir -p /root/agent-defense/logs

echo "Starting Agent Defense services..."
pm2 start /root/agent-defense/ecosystem.config.js
pm2 save

echo ""
echo "Services started:"
pm2 list

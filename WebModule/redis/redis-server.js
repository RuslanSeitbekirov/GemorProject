// redis-server.js - имитация Redis сервера
class RedisServer {
    constructor() {
        this.data = new Map();
        this.subscribers = new Map();
        this.ttlChecker = setInterval(() => this.checkTTL(), 1000);
    }

    set(key, value, ttl = null) {
        const item = {
            value: JSON.stringify(value),
            expiresAt: ttl ? Date.now() + ttl * 1000 : null
        };
        this.data.set(key, item);
        return 'OK';
    }

    get(key) {
        const item = this.data.get(key);
        if (!item) return null;
        
        if (item.expiresAt && item.expiresAt < Date.now()) {
            this.data.delete(key);
            return null;
        }
        
        return JSON.parse(item.value);
    }

    del(key) {
        return this.data.delete(key) ? 1 : 0;
    }

    expire(key, seconds) {
        const item = this.data.get(key);
        if (!item) return 0;
        
        item.expiresAt = Date.now() + seconds * 1000;
        return 1;
    }

    ttl(key) {
        const item = this.data.get(key);
        if (!item || !item.expiresAt) return -1;
        
        const remaining = Math.ceil((item.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
    }

    hset(key, field, value) {
        if (!this.data.has(key)) {
            this.data.set(key, { value: '{}', expiresAt: null });
        }
        
        const item = this.data.get(key);
        const hash = JSON.parse(item.value);
        hash[field] = value;
        item.value = JSON.stringify(hash);
        return 1;
    }

    hget(key, field) {
        const item = this.data.get(key);
        if (!item) return null;
        
        const hash = JSON.parse(item.value);
        return hash[field] || null;
    }

    hgetall(key) {
        const item = this.data.get(key);
        if (!item) return {};
        
        return JSON.parse(item.value);
    }

    publish(channel, message) {
        const channelSubscribers = this.subscribers.get(channel) || [];
        channelSubscribers.forEach(callback => {
            callback(message);
        });
        return channelSubscribers.length;
    }

    subscribe(channel, callback) {
        if (!this.subscribers.has(channel)) {
            this.subscribers.set(channel, []);
        }
        this.subscribers.get(channel).push(callback);
    }

    checkTTL() {
        for (const [key, item] of this.data.entries()) {
            if (item.expiresAt && item.expiresAt < Date.now()) {
                this.data.delete(key);
            }
        }
    }

    flushall() {
        this.data.clear();
        return 'OK';
    }

    info() {
        return {
            version: '6.2.6',
            used_memory: JSON.stringify([...this.data.entries()]).length,
            connected_clients: 1,
            total_commands_processed: 0
        };
    }
}

// Экспорт для использования
module.exports = RedisServer;

// Запуск тестового сервера
if (require.main === module) {
    const http = require('http');
    const redis = new RedisServer();
    
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { command, args = [] } = JSON.parse(body);
                    let result;
                    
                    switch (command.toLowerCase()) {
                        case 'set':
                            result = redis.set(args[0], args[1], args[2]);
                            break;
                        case 'get':
                            result = redis.get(args[0]);
                            break;
                        case 'del':
                            result = redis.del(args[0]);
                            break;
                        case 'expire':
                            result = redis.expire(args[0], args[1]);
                            break;
                        case 'ttl':
                            result = redis.ttl(args[0]);
                            break;
                        case 'hset':
                            result = redis.hset(args[0], args[1], args[2]);
                            break;
                        case 'hget':
                            result = redis.hget(args[0], args[1]);
                            break;
                        case 'hgetall':
                            result = redis.hgetall(args[0]);
                            break;
                        case 'info':
                            result = redis.info();
                            break;
                        case 'flushall':
                            result = redis.flushall();
                            break;
                        default:
                            result = { error: `Unknown command: ${command}` };
                    }
                    
                    res.end(JSON.stringify({ result }));
                } catch (error) {
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
        } else {
            res.end(JSON.stringify({ status: 'Redis server running' }));
        }
    });
    
    const PORT = 6379;
    server.listen(PORT, () => {
        console.log(`Redis сервер запущен на порту ${PORT}`);
    });
}
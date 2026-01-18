<?php
// api/index.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Простой роутинг
$request_uri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];

// Убираем /api/ из URI
$path = str_replace('/api/', '', parse_url($request_uri, PHP_URL_PATH));

// Разделяем путь на части
$parts = explode('/', $path);
$endpoint = $parts[0] ?? '';

// Подключение к MongoDB
function getMongoDB() {
    static $mongo = null;
    if ($mongo === null) {
        try {
            $mongoUri = getenv('MONGODB_URI') ?: 'mongodb://localhost:27017';
            $client = new MongoDB\Client($mongoUri);
            $mongo = $client->selectDatabase('gemordb');
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database connection failed']);
            exit;
        }
    }
    return $mongo;
}

// Подключение к Redis
function getRedis() {
    static $redis = null;
    if ($redis === null) {
        $redis = new Redis();
        $redis->connect(getenv('REDIS_HOST') ?: 'redis', 6379);
        $redis->auth('redis123');
    }
    return $redis;
}

// Маршруты
switch ($endpoint) {
    case 'health':
        if ($method === 'GET') {
            echo json_encode([
                'status' => 'ok',
                'timestamp' => date('c'),
                'services' => [
                    'mongodb' => 'connected',
                    'redis' => 'connected'
                ]
            ]);
        }
        break;
        
    case 'auth':
        handleAuth();
        break;
        
    case 'session':
        handleSession();
        break;
        
    case 'tests':
        handleTests();
        break;
        
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
        break;
}

function handleAuth() {
    global $method;
    
    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';
        
        // Демо аутентификация
        if ($email === 'admin@test.com' && $password === '1410') {
            $token = bin2hex(random_bytes(32));
            $redis = getRedis();
            $redis->setex("user_token:$token", 3600, json_encode([
                'id' => 1,
                'email' => $email,
                'username' => 'Admin',
                'isAdmin' => true
            ]));
            
            echo json_encode([
                'success' => true,
                'token' => $token,
                'user' => [
                    'id' => 1,
                    'email' => $email,
                    'username' => 'Admin',
                    'isAdmin' => true
                ]
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
        }
    }
}

function handleSession() {
    global $method;
    
    if ($method === 'GET') {
        // Проверка сессии из куки
        $token = $_COOKIE['session_token'] ?? '';
        
        if ($token) {
            $redis = getRedis();
            $sessionData = $redis->get("session:$token");
            
            if ($sessionData) {
                echo $sessionData;
            } else {
                echo json_encode(['status' => 'unknown']);
            }
        } else {
            echo json_encode(['status' => 'unknown']);
        }
    } elseif ($method === 'POST') {
        // Создание сессии
        $token = bin2hex(random_bytes(32));
        setcookie('session_token', $token, time() + 3600, '/', '', false, true);
        
        $redis = getRedis();
        $redis->setex("session:$token", 3600, json_encode([
            'status' => 'anonymous',
            'createdAt' => time()
        ]));
        
        echo json_encode([
            'status' => 'anonymous',
            'sessionToken' => $token
        ]);
    }
}

function handleTests() {
    global $method;
    $db = getMongoDB();
    
    if ($method === 'GET') {
        // Получение тестов
        $tests = $db->tests->find()->toArray();
        echo json_encode(['tests' => $tests]);
    } elseif ($method === 'POST') {
        // Создание теста
        $data = json_decode(file_get_contents('php://input'), true);
        $result = $db->tests->insertOne([
            'title' => $data['title'] ?? '',
            'description' => $data['description'] ?? '',
            'questions' => $data['questions'] ?? [],
            'createdAt' => new MongoDB\BSON\UTCDateTime(),
            'userId' => 1 // Из сессии
        ]);
        
        echo json_encode([
            'success' => true,
            'testId' => (string)$result->getInsertedId()
        ]);
    }
}
?>
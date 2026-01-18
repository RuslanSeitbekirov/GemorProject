import os
import secrets
import jwt
import time
import json
import re
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from functools import wraps
import requests
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from flask import Flask, request, jsonify, render_template, url_for, redirect, flash, session, Response
from requests_oauthlib import OAuth2Session
from threading import Thread
from dotenv import load_dotenv

# Загружаем переменные из .env файла
load_dotenv('../../.env.example')
# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# ВАЖНО: Удали все временные переменные окружения из кода!
# Создай файл .env и добавь туда реальные ключи
# Никогда не храни секреты в коде!

# ============ КОНФИГУРАЦИЯ ============
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 1
REFRESH_TOKEN_EXPIRE_DAYS = 7
LOGIN_TOKEN_EXPIRE_MINUTES = 5

# ============ Redis ============

# ============ MongoDB ============
try:
    mongo_uri = os.environ.get('MONGO_URI', "mongodb://localhost:27017/")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')  # Проверка соединения
    db = client["auth_db"]
    users_collection = db["users"]
    refresh_tokens_collection = db["refresh_tokens"]
    logger.info("MongoDB connection established")
except ConnectionFailure as e:
    logger.error(f"MongoDB connection failed: {e}")
    raise

# Хранение временных состояний в памяти (по ТЗ)
login_states = {}  # login_token -> {expires, status, access_token, refresh_token, type}
codes = {}  # code -> {login_token, expires}

# ============ OAUTH КОНФИГУРАЦИЯ ============

# GitHub OAuth - значения должны быть в переменных окружения
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID', '')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET', '')
GITHUB_AUTHORIZATION_BASE_URL = 'https://github.com/login/oauth/authorize'
GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
GITHUB_USER_URL = 'https://api.github.com/user'
GITHUB_EMAIL_URL = 'https://api.github.com/user/emails'
GITHUB_REDIRECT_URI = 'http://localhost:5000/callback/github'

# Yandex OAuth - значения должны быть в переменных окружения
YANDEX_CLIENT_ID = os.environ.get('YANDEX_CLIENT_ID', '')
YANDEX_CLIENT_SECRET = os.environ.get('YANDEX_CLIENT_SECRET', '')
YANDEX_AUTHORIZATION_BASE_URL = 'https://oauth.yandex.ru/authorize'
YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token'
YANDEX_USER_URL = 'https://login.yandex.ru/info'


# Валидация email
def is_valid_email(email: str) -> bool:
    """Проверка валидности email"""
    if not email:
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


# ============ ФУНКЦИИ ============
def generate_login_token() -> str:
    """Генерация токена входа"""
    return secrets.token_urlsafe(32)


def generate_access_token(user_id: str, permissions: list, email: str) -> str:
    """Генерация JWT токена доступа"""
    expire = datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        'sub': user_id,
        'email': email,
        'permissions': permissions,
        'exp': expire,
        'iat': datetime.now(),
        'type': 'access'
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def generate_refresh_token(user_id: str, email: str) -> str:
    """Генерация JWT токена обновления"""
    expire = datetime.now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        'sub': user_id,
        'email': email,
        'exp': expire,
        'iat': datetime.now(),
        'type': 'refresh'
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str, token_type: str = 'access') -> Optional[dict]:
    """Проверка JWT токена"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != token_type:
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_permissions_by_roles(roles: list) -> list:
    """Получение списка разрешений на основе ролей (из ТЗ)"""
    permissions = []

    # Студент (из ТЗ - базовые права)
    if 'student' in roles:
        permissions.extend([
            'user:data:read:self',
            'course:testList:enrolled',
            'course:test:read:enrolled',
            'course:user:add:self',
            'course:user:del:self',
            'attempt:create',
            'attempt:update:self',
            'attempt:complete:self',
            'attempt:read:self',
            'answer:read:self',
            'answer:update:self',
            'answer:del:self',
        ])

    # Преподаватель (из ТЗ)
    if 'teacher' in roles:
        permissions.extend([
            'user:list:read',
            'user:data:read',
            'course:info:write:own',
            'course:testList:own',
            'course:test:read:own',
            'course:test:write:own',
            'course:test:add:own',
            'course:test:del:own',
            'course:userList:own',
            'course:user:add:own',
            'course:user:del:own',
            'course:del:own',
            'quest:list:read:own',
            'quest:read:own',
            'quest:update:own',
            'quest:del:own',
            'test:quest:del:own',
            'test:quest:add:own',
            'test:quest:update:own',
            'test:answer:read:own',
        ])

    # Администратор (из ТЗ)
    if 'admin' in roles:
        permissions.extend([
            'user:fullName:write',
            'user:roles:read',
            'user:roles:write',
            'user:block:read',
            'user:block:write',
            'course:add',
            'course:del:any',
            'quest:create',
            'quest:read:any',
            'quest:update:any',
            'quest:del:any',
        ])

    return list(set(permissions))


def add_refresh_token(user_id: str, refresh_token: str):
    """Добавление refresh токена в базу данных"""
    refresh_tokens_collection.insert_one({
        'user_id': user_id,
        'token': refresh_token,
        'created_at': datetime.now(),
        'expires_at': datetime.now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    })


def remove_refresh_token(refresh_token: str):
    """Удаление refresh токена из базы данных"""
    refresh_tokens_collection.delete_one({'token': refresh_token})


def is_refresh_token_valid(refresh_token: str) -> bool:
    """Проверка валидности refresh токена"""
    token_data = verify_token(refresh_token, 'refresh')
    if not token_data:
        return False

    stored_token = refresh_tokens_collection.find_one({'token': refresh_token})
    if not stored_token:
        return False

    if datetime.now() > stored_token['expires_at']:
        refresh_tokens_collection.delete_one({'token': refresh_token})
        return False

    return True


def create_or_get_user(email: str, name: str, auth_type: str = 'unknown') -> dict:
    """Создание нового пользователя или получение существующего (по ТЗ)"""
    if not email or not is_valid_email(email):
        logger.warning(f"Invalid email provided: {email}")
        return None

    user = users_collection.find_one({'email': email})

    if not user:
        # Создаем нового пользователя (по ТЗ: Аноним+номер, роль "Студент")
        count = users_collection.count_documents({})
        username = f'Аноним{count + 1}'

        user_data = {
            'email': email,
            'name': name if name else username,
            'username': username,
            'roles': ['student'],
            'refresh_tokens': [],
            'created_at': datetime.now(),
            'auth_type': auth_type,
            'blocked': False,
            'last_login': datetime.now()
        }

        result = users_collection.insert_one(user_data)
        user_data['_id'] = result.inserted_id
        user = user_data
        logger.info(f"New user created: {email}")

    # Обновляем время последнего входа
    users_collection.update_one(
        {'_id': user['_id']},
        {'$set': {'last_login': datetime.now()}}
    )

    return user


def cleanup_expired_data():
    """Очистка устаревших данных (по ТЗ)"""
    while True:
        time.sleep(60)  # Проверка каждую минуту
        current_time = datetime.now()

        try:
            # Очистка устаревших состояний авторизации
            expired_login_tokens = [
                token for token, state in login_states.items()
                if current_time > state['expires']
            ]
            for token in expired_login_tokens:
                del login_states[token]

            # Очистка устаревших кодов
            expired_codes = [
                code for code, data in codes.items()
                if current_time > data['expires']
            ]
            for code in expired_codes:
                del codes[code]

            # Очистка устаревших refresh токенов
            refresh_tokens_collection.delete_many({
                'expires_at': {'$lt': current_time}
            })


        except Exception as e:
            logger.error(f"Error in cleanup: {e}")


# ============ МАРШРУТЫ ДЛЯ ДРУГИХ МОДУЛЕЙ (Web Client / Bot Logic) ============
@app.route('/auth', methods=['GET'])
def start_auth():
    """
    Начало процесса авторизации (по ТЗ).
    Web Client или Bot Logic обращаются сюда с токеном входа.
    """
    auth_type = request.args.get('type')  # github, yandex, или code
    login_token = request.args.get('token')  # токен входа от клиента

    if not auth_type or not login_token:
        return jsonify({'error': 'Missing parameters'}), 400

    # Сохраняем состояние авторизации (по ТЗ: Устареет через 5 минут)
    login_states[login_token] = {
        'expires': datetime.now() + timedelta(minutes=LOGIN_TOKEN_EXPIRE_MINUTES),
        'status': 'не получен',
        'access_token': None,
        'refresh_token': None,
        'type': auth_type,
        'created_at': datetime.now()
    }

    if auth_type == 'github':
        if not GITHUB_CLIENT_ID:
            return jsonify({'error': 'GitHub OAuth not configured'}), 500

        github = OAuth2Session(GITHUB_CLIENT_ID,scope=['read:user', 'user:email'])
        authorization_url, state = github.authorization_url(
            GITHUB_AUTHORIZATION_BASE_URL,
            state=login_token
        )

        return redirect(authorization_url)

    elif auth_type == 'yandex':
        if not YANDEX_CLIENT_ID:
            return jsonify({'error': 'Yandex OAuth not configured'}), 500

        yandex = OAuth2Session(YANDEX_CLIENT_ID, scope=['login:info', 'login:email'])
        authorization_url, state = yandex.authorization_url(
            YANDEX_AUTHORIZATION_BASE_URL,
            state=login_token
        )

        return redirect(authorization_url)

    elif auth_type == 'code':
        # Генерация 6-значного кода (по ТЗ)
        code = secrets.randbelow(900000) + 100000
        codes[code] = {
            'login_token': login_token,
            'expires': datetime.now() + timedelta(minutes=1)  # 1 минута по ТЗ
        }
        return jsonify({'code': code})

    return jsonify({'error': 'Invalid auth type'}), 400


@app.route('/auth/check', methods=['GET'])
def check_auth_status():
    """
    Проверка статуса авторизации по токену входа (по ТЗ).
    Используется Web Client и Bot Logic для опроса статуса.
    """
    login_token = request.args.get('token')

    if not login_token:
        return jsonify({'error': 'Missing token'}), 400

    state = login_states.get(login_token)
    if not state:
        return jsonify({'status': 'не опознанный токен'})

    if datetime.now() > state['expires']:
        del login_states[login_token]
        return jsonify({'status': 'время действия токена закончилось'})

    if state['status'] == 'в доступе отказано':
        del login_states[login_token]
        return jsonify({'status': 'в доступе отказано'})

    if state['status'] == 'доступ предоставлен':
        response_data = {
            'status': 'доступ предоставлен',
            'access_token': state['access_token'],
            'refresh_token': state['refresh_token']
        }
        del login_states[login_token]
        return jsonify(response_data)

    return jsonify({'status': 'не получен'})


@app.route('/auth/refresh', methods=['POST'])
def refresh_tokens():
    """
    Обновление access token по refresh token (по ТЗ).
    """
    refresh_token = request.json.get('refresh_token')

    if not refresh_token:
        return jsonify({'error': 'Missing refresh token'}), 400

    # Проверяем валидность refresh токена
    if not is_refresh_token_valid(refresh_token):
        remove_refresh_token(refresh_token)
        return jsonify({'error': 'Refresh token expired or invalid'}), 401

    token_data = verify_token(refresh_token, 'refresh')
    if not token_data:
        remove_refresh_token(refresh_token)
        return jsonify({'error': 'Invalid refresh token'}), 401

    # Получаем пользователя
    user = users_collection.find_one({'email': token_data['email']})
    if not user or user.get('blocked', False):
        remove_refresh_token(refresh_token)
        return jsonify({'error': 'User not found or blocked'}), 404

    # Генерируем новую пару токенов
    permissions = get_permissions_by_roles(user['roles'])
    new_access_token = generate_access_token(str(user['_id']), permissions, user['email'])
    new_refresh_token = generate_refresh_token(str(user['_id']), user['email'])

    # Заменяем старый refresh токен новым (по ТЗ)
    remove_refresh_token(refresh_token)
    add_refresh_token(str(user['_id']), new_refresh_token)

    return jsonify({
        'access_token': new_access_token,
        'refresh_token': new_refresh_token
    })


@app.route('/auth/logout', methods=['POST'])
def logout_all():
    """
    Выход из системы на всех устройствах (по ТЗ).
    """
    refresh_token = request.json.get('refresh_token')

    if refresh_token:
        remove_refresh_token(refresh_token)

    return jsonify({'message': 'Logged out successfully'})


@app.route('/auth/code/verify', methods=['POST'])
def verify_auth_code():
    """
    Проверка кода авторизации (по ТЗ).
    """
    data = request.json
    code = data.get('code')
    refresh_token = data.get('refresh_token')

    if not code or not refresh_token:
        return jsonify({'error': 'Missing parameters'}), 400

    # Проверяем refresh token
    token_data = verify_token(refresh_token, 'refresh')
    if not token_data:
        return jsonify({'error': 'Invalid refresh token'}), 401

    # Проверяем код
    try:
        code_int = int(code)
    except ValueError:
        return jsonify({'error': 'Invalid code format'}), 400

    code_data = codes.get(code_int)
    if not code_data:
        return jsonify({'error': 'Invalid or expired code'}), 400

    if datetime.now() > code_data['expires']:
        del codes[code_int]
        return jsonify({'error': 'Code expired'}), 400

    login_token = code_data['login_token']

    # Получаем пользователя из refresh token
    user = users_collection.find_one({'email': token_data['email']})
    if not user or user.get('blocked', False):
        return jsonify({'error': 'User not found or blocked'}), 404

    # Генерируем токены
    permissions = get_permissions_by_roles(user['roles'])
    access_token = generate_access_token(str(user['_id']), permissions, user['email'])
    new_refresh_token = generate_refresh_token(str(user['_id']), user['email'])

    # Обновляем состояние авторизации
    if login_token in login_states:
        login_states[login_token].update({
            'status': 'доступ предоставлен',
            'access_token': access_token,
            'refresh_token': new_refresh_token
        })

    # Добавляем новый refresh token
    add_refresh_token(str(user['_id']), new_refresh_token)

    # Удаляем использованный код
    del codes[code_int]

    return jsonify({'success': True})


# ============ CALLBACK МАРШРУТЫ ДЛЯ OAUTH ============
@app.route('/callback/github')
def github_callback():
    code = request.args.get('code')
    login_token = request.args.get('state')
    error = request.args.get('error')

    if error:
        if login_token in login_states:
            login_states[login_token]['status'] = 'в доступе отказано'
        return render_template('auth_error.html', message='Авторизация отклонена пользователем')

    if not code or not login_token:
        return render_template('auth_error.html', message='Отсутствуют параметры авторизации'), 400

    try:
        # 🔹 ШАГ 1: обмен code → access_token (вручную, без OAuth2Session)
        token_response = requests.post(
            GITHUB_TOKEN_URL,
            headers={'Accept': 'application/json'},
            data={
                'client_id': GITHUB_CLIENT_ID,
                'client_secret': GITHUB_CLIENT_SECRET,
                'code': code,
                'redirect_uri': GITHUB_REDIRECT_URI
            }
        )

        token_data = token_response.json()
        access_token = token_data.get('access_token')

        if not access_token:
            raise Exception('Не удалось получить access_token от GitHub')

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }

        # 🔹 ШАГ 2: профиль пользователя
        user_data = requests.get(GITHUB_USER_URL, headers=headers).json()

        # 🔹 ШАГ 3: email
        email = user_data.get('email')
        if not email:
            emails = requests.get(GITHUB_EMAIL_URL, headers=headers).json()
            primary = next(
                (e for e in emails if e.get('primary') and e.get('verified')),
                None
            )
            if primary:
                email = primary.get('email')

        if not email or not is_valid_email(email):
            login_states[login_token]['status'] = 'в доступе отказано'
            return render_template('auth_error.html', message='GitHub не вернул email'), 400

        name = user_data.get('name') or user_data.get('login')

        # 🔹 ШАГ 4: пользователь
        user = create_or_get_user(email, name, 'github')

        if user.get('blocked'):
            login_states[login_token]['status'] = 'в доступе отказано'
            return render_template('auth_error.html', message='Пользователь заблокирован'), 403

        # 🔹 ШАГ 5: токены
        permissions = get_permissions_by_roles(user['roles'])
        access_jwt = generate_access_token(str(user['_id']), permissions, email)
        refresh_jwt = generate_refresh_token(str(user['_id']), email)

        add_refresh_token(str(user['_id']), refresh_jwt)

        login_states[login_token].update({
            'status': 'доступ предоставлен',
            'access_token': access_jwt,
            'refresh_token': refresh_jwt
        })

        return render_template(
            'auth_success.html',
            message='Авторизация через GitHub успешна!',
            provider='GitHub'
        )

    except Exception as e:
        logger.exception('GitHub OAuth failed')
        if login_token in login_states:
            login_states[login_token]['status'] = 'в доступе отказано'
        return render_template('auth_error.html', message=str(e)), 500



@app.route('/callback/yandex')
def yandex_callback():
    """
    Callback от Yandex OAuth (по ТЗ).
    """
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')

    if error:
        if state:
            login_token = None

            if login_token and login_token in login_states:
                login_states[login_token]['status'] = 'в доступе отказано'
        return render_template('auth_error.html', message='Авторизация отклонена пользователем')

    if not code or not state:
        return render_template('auth_error.html', message='Отсутствуют параметры авторизации'), 400

    login_token = state

    if not login_token:
        return render_template('auth_error.html', message='Неверный state параметр'), 400

    try:
        # Обмен кода на access token
        yandex = OAuth2Session(YANDEX_CLIENT_ID)
        token = yandex.fetch_token(
            YANDEX_TOKEN_URL,
            client_secret=YANDEX_CLIENT_SECRET,
            code=code,
            method='POST'
        )

        # Получение данных пользователя
        headers = {'Authorization': f'OAuth {token["access_token"]}'}
        user_response = requests.get(f"{YANDEX_USER_URL}?format=json", headers=headers)
        user_data = user_response.json()

        email = user_data.get('default_email')
        name = user_data.get('real_name') or user_data.get('display_name') or user_data.get('login')

        if not email or not is_valid_email(email):
            if login_token in login_states:
                login_states[login_token]['status'] = 'в доступе отказано'
            return render_template('auth_error.html', message='Не удалось получить email пользователя'), 400

        # Создаем/получаем пользователя
        user = create_or_get_user(email, name, 'yandex')

        if user and user.get('blocked'):
            if login_token in login_states:
                login_states[login_token]['status'] = 'в доступе отказано'
            return render_template('auth_error.html', message='Пользователь заблокирован'), 403

        # Генерируем токены
        permissions = get_permissions_by_roles(user['roles'])
        access_token = generate_access_token(str(user['_id']), permissions, email)
        refresh_token = generate_refresh_token(str(user['_id']), email)

        # Сохраняем refresh token
        add_refresh_token(str(user['_id']), refresh_token)

        # Обновляем состояние авторизации
        if login_token in login_states:
            login_states[login_token].update({
                'status': 'доступ предоставлен',
                'access_token': access_token,
                'refresh_token': refresh_token
            })

        return render_template('auth_success.html',
                               message='Авторизация через Яндекс успешна!',
                               provider='Яндекс')

    except Exception as e:
        logger.error(f"Yandex OAuth error: {e}")
        if login_token in login_states:
            login_states[login_token]['status'] = 'в доступе отказано'
        return render_template('auth_error.html', message=f'Ошибка авторизации: {str(e)}'), 500


# ============ HTML СТРАНИЦЫ ============
@app.route('/')
def index():
    """Главная страница (по ТЗ: предлагает авторизацию)"""
    return render_template('login.html')


@app.route('/login', methods=['GET'])
def login():
    """Страница входа с выбором метода аутентификации"""
    auth_type = request.args.get('type')
    code_input = request.args.get('code')
    get_code = request.args.get('get_code')

    if auth_type == 'github' or auth_type == 'yandex':
        # Генерация токена входа и перенаправление на /auth
        login_token = generate_login_token()
        auth_url = url_for('start_auth', type=auth_type, token=login_token)
        return redirect(auth_url)

    elif auth_type == 'code':
        if code_input:
            # Если введен код, обрабатываем его
            try:
                code_int = int(code_input)
                if code_int in codes:
                    # Код найден, продолжаем процесс авторизации
                    login_token = codes[code_int]['login_token']
                    auth_url = url_for('start_auth', type='code', token=login_token)
                    return redirect(auth_url)
                else:
                    # Код не найден
                    return render_template("login.html", error="Invalid or expired code")
            except ValueError:
                return render_template("login.html", error="Code must be 6 digits")
        elif get_code:
            # Генерация нового кода для демонстрации
            login_token = generate_login_token()
            code = secrets.randbelow(900000) + 100000
            codes[code] = {
                'login_token': login_token,
                'expires': datetime.now() + timedelta(minutes=1)
            }
            return render_template("login.html", code=str(code))
        else:
            # Просто показываем страницу с формой ввода кода
            return render_template("login.html")

    else:
        # Показываем страницу с выбором метода авторизации
        return render_template("login.html")


@app.route('/account')
def account_page():
    """Страница аккаунта (личный кабинет)"""
    if 'user_id' not in session:
        return redirect(url_for('login'))  # Исправлено: было 'login_page'

    return render_template('account.html',
                           username=session.get('username', 'Гость'),
                           email=session.get('email', ''))


@app.route('/auth/success')
def auth_success_page():
    """Страница успешной авторизации"""
    return render_template('auth_success.html',
                           message='Авторизация успешна!',
                           provider=request.args.get('provider', ''))


@app.route('/auth/error')
def auth_error_page():
    """Страница ошибки авторизации"""
    return render_template('auth_error.html',
                           message=request.args.get('message', 'Произошла ошибка авторизации'))


# ============ API ДЛЯ ВАЛИДАЦИИ ТОКЕНОВ ============
@app.route('/auth/validate', methods=['POST'])
def validate_token():
    """
    Валидация JWT токена (для Главного модуля).
    """
    token = request.json.get('token')

    if not token:
        return jsonify({'error': 'Token is missing'}), 400

    # Проверяем токен
    payload = verify_token(token, 'access')
    if not payload:
        return jsonify({'error': 'Invalid or expired token'}), 401

    # Проверяем, не заблокирован ли пользователь
    user = users_collection.find_one({'email': payload['email']})
    if not user or user.get('blocked', False):
        return jsonify({'error': 'User not found or blocked'}), 403

    return jsonify({
        'valid': True,
        'user_id': payload['sub'],
        'email': payload['email'],
        'permissions': payload.get('permissions', []),
        'expires_at': datetime.utcfromtimestamp(payload['exp']).isoformat()
    })


@app.route('/auth/permissions', methods=['GET'])
def get_user_permissions():
    """
    Получение прав пользователя по email (для других модулей).
    """
    email = request.args.get('email')

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = users_collection.find_one({'email': email})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    permissions = get_permissions_by_roles(user['roles'])

    return jsonify({
        'user_id': str(user['_id']),
        'email': user['email'],
        'roles': user['roles'],
        'permissions': permissions
    })


# ============ УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ============
@app.route('/users/<user_id>/block', methods=['POST'])
def block_user(user_id):
    """
    Блокировка/разблокировка пользователя.
    """
    # В реальной реализации здесь должна быть проверка JWT токена и прав
    action = request.json.get('action', 'block')  # block или unblock

    try:
        user = users_collection.find_one({'_id': user_id})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        blocked = action == 'block'
        users_collection.update_one(
            {'_id': user_id},
            {'$set': {'blocked': blocked}}
        )

        # При блокировке удаляем все refresh токены
        if blocked:
            refresh_tokens_collection.delete_many({'user_id': user_id})

        return jsonify({
            'success': True,
            'message': f'User {"blocked" if blocked else "unblocked"} successfully'
        })

    except Exception as e:
        logger.error(f"Error blocking user: {e}")
        return jsonify({'error': str(e)}), 500


# ============ ЗДОРОВЬЕ СЕРВИСА ============
@app.route('/health', methods=['GET'])
def health_check():
    """Проверка здоровья сервиса"""
    try:
        client.admin.command('ping')
        mongo_status = 'healthy'
    except Exception as e:
        mongo_status = f'unhealthy: {str(e)}'

    return jsonify({
        'status': 'running',
        'timestamp': datetime.now().isoformat(),
        'services': {
            'mongodb': mongo_status
        },
        'stats': {
            'active_login_states': len(login_states),
            'active_codes': len(codes),
            'total_users': users_collection.count_documents({})
        }
    })


# ============ ЗАПУСК СЕРВЕРА ============
if __name__ == '__main__':
    # Запускаем фоновую задачу для очистки устаревших данных
    cleanup_thread = Thread(target=cleanup_expired_data, daemon=True)
    cleanup_thread.start()

    # Создаем индексы в MongoDB
    users_collection.create_index([('email', 1)], unique=True)
    users_collection.create_index([('last_login', -1)])
    refresh_tokens_collection.create_index([('expires_at', 1)], expireAfterSeconds=0)
    refresh_tokens_collection.create_index([('token', 1)], unique=True)

    logger.info("Authorization server starting on http://localhost:5000")
    logger.info(f"GitHub OAuth configured: {'Yes' if GITHUB_CLIENT_ID else 'No'}")
    logger.info(f"Yandex OAuth configured: {'Yes' if YANDEX_CLIENT_ID else 'No'}")

    app.run(host='0.0.0.0', port=5000, debug=True)
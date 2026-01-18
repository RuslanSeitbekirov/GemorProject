-- Пользователи
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Роли пользователей
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    PRIMARY KEY (user_id, role)
);

-- Курсы (дисциплины)
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    teacher_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Запись на курсы
CREATE TABLE IF NOT EXISTS course_enrollments (
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher')),
    PRIMARY KEY (course_id, user_id)
);

-- Тесты
CREATE TABLE IF NOT EXISTS tests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    is_active BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вопросы (версионная структура) - ИЗМЕНЕНО: составной PRIMARY KEY
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    options TEXT[] NOT NULL,
    correct_option INTEGER NOT NULL CHECK (correct_option >= 0),
    points INTEGER DEFAULT 1 CHECK (points > 0),
    author_id INTEGER REFERENCES users(id),
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, version)
);

-- Создаем SEQUENCE для вопросов
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'questions_id_seq') THEN
        CREATE SEQUENCE questions_id_seq;
    END IF;
END $$;

ALTER TABLE questions ALTER COLUMN id SET DEFAULT nextval('questions_id_seq');
SELECT setval('questions_id_seq', COALESCE((SELECT MAX(id) FROM questions), 0) + 1);

-- Связь тестов и вопросов
CREATE TABLE IF NOT EXISTS test_questions (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL,
    question_version INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    UNIQUE(test_id, question_id, question_version),
    FOREIGN KEY (question_id, question_version) REFERENCES questions(id, version)
);

-- Попытки прохождения тестов
CREATE TABLE IF NOT EXISTS attempts (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    score FLOAT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_attempt 
ON attempts(test_id, user_id) 
WHERE status = 'in_progress';

-- Удаляем старую таблицу ответов, если существует
DROP TABLE IF EXISTS attempt_answers CASCADE;

-- Ответы в попытках (с ОБЕИМИ колонками)
CREATE TABLE IF NOT EXISTS attempt_answers (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL,
    question_version INTEGER NOT NULL DEFAULT 1,
    selected_option INTEGER DEFAULT -1 CHECK (selected_option >= -1),
    correct_answer BOOLEAN,
    is_correct BOOLEAN,  -- Дополнительная колонка для совместимости
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id, question_version) REFERENCES questions(id, version)
);

-- Функция для синхронизации колонок correct_answer и is_correct
CREATE OR REPLACE FUNCTION sync_correct_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Всегда синхронизируем обе колонки
    IF NEW.correct_answer IS NOT NULL THEN
        NEW.is_correct := NEW.correct_answer;
    ELSIF NEW.is_correct IS NOT NULL THEN
        NEW.correct_answer := NEW.is_correct;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматической синхронизации
DROP TRIGGER IF EXISTS sync_attempt_answers_correct ON attempt_answers;
CREATE TRIGGER sync_attempt_answers_correct
    BEFORE INSERT OR UPDATE ON attempt_answers
    FOR EACH ROW
    EXECUTE FUNCTION sync_correct_columns();

-- Уведомления
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Индексы для ускорения запросов
CREATE INDEX IF NOT EXISTS idx_tests_course_id ON tests(course_id);
CREATE INDEX IF NOT EXISTS idx_tests_teacher_id ON tests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_test_id ON test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_question ON test_questions(question_id, question_version);
CREATE INDEX IF NOT EXISTS idx_attempts_test_user ON attempts(test_id, user_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question ON attempt_answers(question_id, question_version);
CREATE INDEX IF NOT EXISTS idx_questions_author ON questions(author_id);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_id_version ON questions(id, version);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_questions_latest_version ON questions(id, version DESC);

-- Комментарий к колонке (исправленный)
COMMENT ON COLUMN attempt_answers.correct_answer IS 'Правильность ответа (используется вместо is_correct)';
-- Отключаем проверку внешних ключей для безопасного удаления
SET session_replication_role = 'replica';

-- Удаляем таблицы в правильном порядке (сначала зависимые)
DROP TABLE IF EXISTS attempt_answers CASCADE;
DROP TABLE IF EXISTS attempts CASCADE;
DROP TABLE IF EXISTS test_questions CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP SEQUENCE IF EXISTS questions_id_seq CASCADE;
DROP TABLE IF EXISTS tests CASCADE;
DROP TABLE IF EXISTS course_enrollments CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- Возвращаем проверку внешних ключей
SET session_replication_role = 'origin';
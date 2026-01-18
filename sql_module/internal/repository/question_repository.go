package repository

import (
	"database/sql"
	"fmt"
	"sql_module/internal/models"

	"github.com/lib/pq"
)

type QuestionRepository struct {
	db *sql.DB
}

type QuestionError struct {
	Message string
}

func (e *QuestionError) Error() string {
	return e.Message
}

func NewQuestionRepository(db *sql.DB) *QuestionRepository {
	return &QuestionRepository{db: db}
}

func (r *QuestionRepository) Create(question *models.Question) error {
	// Проверяем, что автор существует
	var userExists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`
	err := r.db.QueryRow(checkQuery, question.AuthorID).Scan(&userExists)
	if err != nil {
		return err
	}
	if !userExists {
		return &QuestionError{Message: "Author does not exist"}
	}

	query := `INSERT INTO questions (title, text, options, correct_option, points, author_id, version) 
              VALUES ($1, $2, $3, $4, $5, $6, 1) 
              RETURNING id, created_at`

	err = r.db.QueryRow(query,
		question.Title,
		question.Text,
		pq.Array(question.Options), // Здесь исправление!
		question.CorrectOption,
		question.Points,
		question.AuthorID).
		Scan(&question.ID, &question.CreatedAt)

	question.Version = 1
	question.IsDeleted = false
	return err
}

func (r *QuestionRepository) GetByID(id int) (*models.Question, error) {
	query := `SELECT id, title, text, options, correct_option, points, author_id, 
                     version, is_deleted, created_at 
              FROM questions 
              WHERE id = $1 AND is_deleted = false 
              ORDER BY version DESC 
              LIMIT 1`
	row := r.db.QueryRow(query, id)

	var question models.Question
	var options pq.StringArray

	err := row.Scan(
		&question.ID,
		&question.Title,
		&question.Text,
		&options,
		&question.CorrectOption,
		&question.Points,
		&question.AuthorID,
		&question.Version,
		&question.IsDeleted,
		&question.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	question.Options = []string(options)
	return &question, nil
}

func (r *QuestionRepository) GetByTeacher(teacherID int) ([]models.Question, error) {
	query := `SELECT DISTINCT ON (id) id, title, text, options, correct_option, points, 
                     author_id, version, is_deleted, created_at 
              FROM questions 
              WHERE author_id = $1 AND is_deleted = false 
              ORDER BY id, version DESC`
	rows, err := r.db.Query(query, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var questions []models.Question
	for rows.Next() {
		var question models.Question
		var options pq.StringArray

		err := rows.Scan(
			&question.ID,
			&question.Title,
			&question.Text,
			&options,
			&question.CorrectOption,
			&question.Points,
			&question.AuthorID,
			&question.Version,
			&question.IsDeleted,
			&question.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		question.Options = []string(options)
		questions = append(questions, question)
	}
	return questions, nil
}

func (r *QuestionRepository) Update(question *models.Question) error {
	var usedInActiveTests bool
	checkQuery := `SELECT EXISTS(
        SELECT 1 FROM test_questions tq
        JOIN tests t ON tq.test_id = t.id
        WHERE tq.question_id = $1 AND t.is_active = true AND t.is_deleted = false
    )`
	err := r.db.QueryRow(checkQuery, question.ID).Scan(&usedInActiveTests)
	if err != nil {
		return err
	}

	if usedInActiveTests {
		// Если вопрос используется в активных тестах, создаем новую версию
		return r.createNewVersion(question)
	} else {
		return r.updateCurrentVersion(question)
	}
}

func (r *QuestionRepository) createNewVersion(question *models.Question) error {
	var maxVersion int
	versionQuery := `SELECT COALESCE(MAX(version), 0) FROM questions WHERE id = $1`
	err := r.db.QueryRow(versionQuery, question.ID).Scan(&maxVersion)
	if err != nil {
		fmt.Printf("DEBUG createNewVersion: Error getting max version: %v\n", err)
		return err
	}

	query := `INSERT INTO questions (id, title, text, options, correct_option, points, author_id, version) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
              RETURNING created_at`

	err = r.db.QueryRow(query,
		question.ID,
		question.Title,
		question.Text,
		pq.Array(question.Options),
		question.CorrectOption,
		question.Points,
		question.AuthorID,
		maxVersion+1).
		Scan(&question.CreatedAt)

	if err != nil {
		return err
	}

	return nil
}

func (r *QuestionRepository) updateCurrentVersion(question *models.Question) error {
	var currentVersion int
	versionQuery := `SELECT COALESCE(MAX(version), 0) FROM questions WHERE id = $1`
	err := r.db.QueryRow(versionQuery, question.ID).Scan(&currentVersion)
	if err != nil {
		return err
	}

	query := `UPDATE questions 
              SET title = $1, text = $2, options = $3, correct_option = $4, points = $5 
              WHERE id = $6 AND version = $7`

	result, err := r.db.Exec(query,
		question.Title,
		question.Text,
		pq.Array(question.Options),
		question.CorrectOption,
		question.Points,
		question.ID,
		currentVersion)

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	question.Version = currentVersion
	return nil
}

func (r *QuestionRepository) Delete(id int) error {
	var usedInTests bool
	checkQuery := `SELECT EXISTS(
        SELECT 1 FROM test_questions WHERE question_id = $1)`
	err := r.db.QueryRow(checkQuery, id).Scan(&usedInTests)
	if err != nil {
		return err
	}

	if usedInTests {
		return &QuestionError{Message: "Cannot delete question that is used in tests"}
	}

	query := `UPDATE questions SET is_deleted = true WHERE id = $1`
	result, err := r.db.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *QuestionRepository) Restore(id int) error {
	query := `UPDATE questions SET is_deleted = false WHERE id = $1`
	result, err := r.db.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *QuestionRepository) GetVersions(id int) ([]models.Question, error) {
	query := `SELECT id, title, text, options, correct_option, points, author_id, 
                     version, is_deleted, created_at 
              FROM questions 
              WHERE id = $1 
              ORDER BY version DESC`
	rows, err := r.db.Query(query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []models.Question
	for rows.Next() {
		var question models.Question
		var options pq.StringArray // ИСПРАВЛЕНИЕ

		err := rows.Scan(
			&question.ID,
			&question.Title,
			&question.Text,
			&options,
			&question.CorrectOption,
			&question.Points,
			&question.AuthorID,
			&question.Version,
			&question.IsDeleted,
			&question.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		question.Options = []string(options)
		versions = append(versions, question)
	}
	return versions, nil
}

func (r *QuestionRepository) GetDeleted() ([]models.Question, error) {
	query := `SELECT DISTINCT ON (id) id, title, text, options, correct_option, points, 
                     author_id, version, is_deleted, created_at 
              FROM questions 
              WHERE is_deleted = true 
              ORDER BY id, version DESC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var questions []models.Question
	for rows.Next() {
		var question models.Question
		var options pq.StringArray

		err := rows.Scan(
			&question.ID,
			&question.Title,
			&question.Text,
			&options,
			&question.CorrectOption,
			&question.Points,
			&question.AuthorID,
			&question.Version,
			&question.IsDeleted,
			&question.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		question.Options = []string(options)
		questions = append(questions, question)
	}
	return questions, nil
}

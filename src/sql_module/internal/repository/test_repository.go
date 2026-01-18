package repository

import (
	"database/sql"
	"fmt"
	"sql_module/internal/models"
)

type TestRepository struct {
	db *sql.DB
}

type TestError struct {
	Message string
}

func (e *TestError) Error() string {
	return e.Message
}

func NewTestRepository(db *sql.DB) *TestRepository {
	return &TestRepository{db: db}
}

func (r *TestRepository) Create(test *models.Test) error {
	query := `INSERT INTO tests (title, description, course_id, teacher_id, is_active) 
              VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`
	err := r.db.QueryRow(query, test.Title, test.Description, test.CourseID,
		test.TeacherID, test.IsActive).
		Scan(&test.ID, &test.CreatedAt)
	return err
}

func (r *TestRepository) GetByID(id int) (*models.Test, error) {
	query := `SELECT id, title, description, course_id, teacher_id, is_active, 
                     is_deleted, created_at 
              FROM tests WHERE id = $1 AND is_deleted = false`
	row := r.db.QueryRow(query, id)

	var test models.Test
	err := row.Scan(
		&test.ID,
		&test.Title,
		&test.Description,
		&test.CourseID,
		&test.TeacherID,
		&test.IsActive,
		&test.IsDeleted,
		&test.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	countQuery := `SELECT COUNT(*) FROM test_questions WHERE test_id = $1`
	err = r.db.QueryRow(countQuery, id).Scan(&test.QuestionsCount)
	if err != nil {
		return &test, nil
	}

	return &test, nil
}

func (r *TestRepository) GetByTeacherID(teacherID int) ([]models.Test, error) {
	query := `SELECT id, title, description, course_id, teacher_id, is_active, 
                     is_deleted, created_at 
              FROM tests 
              WHERE teacher_id = $1 AND is_deleted = false 
              ORDER BY created_at DESC`
	rows, err := r.db.Query(query, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tests []models.Test
	for rows.Next() {
		var test models.Test
		err := rows.Scan(
			&test.ID,
			&test.Title,
			&test.Description,
			&test.CourseID,
			&test.TeacherID,
			&test.IsActive,
			&test.IsDeleted,
			&test.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		countQuery := `SELECT COUNT(*) FROM test_questions WHERE test_id = $1`
		r.db.QueryRow(countQuery, test.ID).Scan(&test.QuestionsCount)

		tests = append(tests, test)
	}
	return tests, nil
}

func (r *TestRepository) GetByCourseID(courseID int) ([]models.Test, error) {
	query := `SELECT id, title, description, course_id, teacher_id, is_active, 
                     is_deleted, created_at 
              FROM tests 
              WHERE course_id = $1 AND is_deleted = false 
              ORDER BY created_at DESC`
	rows, err := r.db.Query(query, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tests []models.Test
	for rows.Next() {
		var test models.Test
		err := rows.Scan(
			&test.ID,
			&test.Title,
			&test.Description,
			&test.CourseID,
			&test.TeacherID,
			&test.IsActive,
			&test.IsDeleted,
			&test.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		countQuery := `SELECT COUNT(*) FROM test_questions WHERE test_id = $1`
		r.db.QueryRow(countQuery, test.ID).Scan(&test.QuestionsCount)

		tests = append(tests, test)
	}
	return tests, nil
}

func (r *TestRepository) AddQuestion(testID, questionID int) error {
	var isActive bool
	checkQuery := `SELECT is_active FROM tests WHERE id = $1 AND is_deleted = false`
	err := r.db.QueryRow(checkQuery, testID).Scan(&isActive)
	if err != nil {
		return err
	}

	if isActive {
		return &TestError{Message: "Cannot add questions to active test"}
	}

	var exists bool
	existsQuery := `SELECT EXISTS(SELECT 1 FROM test_questions WHERE test_id = $1 AND question_id = $2)`
	err = r.db.QueryRow(existsQuery, testID, questionID).Scan(&exists)
	if err != nil {
		return err
	}

	if exists {
		return &TestError{Message: "Question already exists in this test"}
	}

	var maxOrder int
	orderQuery := `SELECT COALESCE(MAX(order_index), 0) FROM test_questions WHERE test_id = $1`
	err = r.db.QueryRow(orderQuery, testID).Scan(&maxOrder)
	if err != nil {
		return err
	}

	insertQuery := `INSERT INTO test_questions (test_id, question_id, order_index) 
                    VALUES ($1, $2, $3)`
	_, err = r.db.Exec(insertQuery, testID, questionID, maxOrder+1)
	return err
}

func (r *TestRepository) RemoveQuestion(testID, questionID int) error {
	var isActive bool
	checkQuery := `SELECT is_active FROM tests WHERE id = $1 AND is_deleted = false`
	err := r.db.QueryRow(checkQuery, testID).Scan(&isActive)
	if err != nil {
		return err
	}

	if isActive {
		return &TestError{Message: "Cannot remove questions from active test"}
	}

	query := `DELETE FROM test_questions WHERE test_id = $1 AND question_id = $2`
	result, err := r.db.Exec(query, testID, questionID)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *TestRepository) reorderQuestions(testID int) error {
	query := `
		WITH numbered AS (
			SELECT id, ROW_NUMBER() OVER (ORDER BY order_index) - 1 as new_order
			FROM test_questions 
			WHERE test_id = $1
		)
		UPDATE test_questions tq
		SET order_index = n.new_order
		FROM numbered n
		WHERE tq.id = n.id AND tq.test_id = $1`

	_, err := r.db.Exec(query, testID)
	return err
}

func (r *TestRepository) GetQuestions(testID int) ([]models.TestQuestion, error) {
	query := `SELECT id, test_id, question_id, order_index
              FROM test_questions 
              WHERE test_id = $1 
              ORDER BY order_index`

	rows, err := r.db.Query(query, testID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var questions []models.TestQuestion
	for rows.Next() {
		var q models.TestQuestion
		err := rows.Scan(&q.ID, &q.TestID, &q.QuestionID, &q.OrderIndex)
		if err != nil {
			return nil, err
		}
		questions = append(questions, q)
	}

	return questions, nil
}

func (r *TestRepository) Update(test *models.Test) error {
	query := `UPDATE tests SET title = $1, description = $2, is_active = $3 
              WHERE id = $4 AND is_deleted = false`
	result, err := r.db.Exec(query, test.Title, test.Description, test.IsActive, test.ID)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *TestRepository) Delete(id int) error {
	var activeAttempts int
	checkQuery := `SELECT COUNT(*) FROM attempts 
                   WHERE test_id = $1 AND status = 'in_progress'`
	err := r.db.QueryRow(checkQuery, id).Scan(&activeAttempts)
	if err != nil {
		return err
	}

	if activeAttempts > 0 {
		return &TestError{Message: "Cannot delete test with active attempts"}
	}

	query := `UPDATE tests SET is_deleted = true WHERE id = $1`
	result, err := r.db.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	completeQuery := `UPDATE attempts SET status = 'completed', completed_at = NOW() 
                      WHERE test_id = $1 AND status = 'in_progress'`
	r.db.Exec(completeQuery, id)

	return nil
}

func (r *TestRepository) Restore(id int) error {
	query := `UPDATE tests SET is_deleted = false WHERE id = $1`
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

func (r *TestRepository) SetActive(id int, active bool) error {
	query := `UPDATE tests SET is_active = $1 WHERE id = $2 AND is_deleted = false`
	result, err := r.db.Exec(query, active, id)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *TestRepository) GetQuestionOrder(testID int) ([]int, error) {
	query := `SELECT question_id FROM test_questions 
              WHERE test_id = $1 
              ORDER BY order_index ASC`
	rows, err := r.db.Query(query, testID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var questionIDs []int
	for rows.Next() {
		var questionID int
		err := rows.Scan(&questionID)
		if err != nil {
			return nil, err
		}
		questionIDs = append(questionIDs, questionID)
	}
	return questionIDs, nil
}

func (r *TestRepository) GetTestWithQuestions(testID int) (*models.Test, []models.Question, error) {
	test, err := r.GetByID(testID)
	if err != nil {
		return nil, nil, err
	}
	if test == nil {
		return nil, nil, fmt.Errorf("test not found")
	}

	query := `
		SELECT q.id, q.title, q.text, q.options, q.correct_option, q.points, 
               q.author_id, q.version, q.is_deleted, q.created_at
		FROM questions q
		INNER JOIN test_questions tq ON q.id = tq.question_id
		WHERE tq.test_id = $1 AND q.is_deleted = false
		ORDER BY tq.order_index ASC`

	rows, err := r.db.Query(query, testID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var questions []models.Question
	for rows.Next() {
		var q models.Question
		err := rows.Scan(
			&q.ID,
			&q.Title,
			&q.Text,
			&q.Options,
			&q.CorrectOption,
			&q.Points,
			&q.AuthorID,
			&q.Version,
			&q.IsDeleted,
			&q.CreatedAt,
		)
		if err != nil {
			return nil, nil, err
		}
		questions = append(questions, q)
	}

	return test, questions, nil
}

func (r *TestRepository) UpdateQuestionOrder(testID int, questionIDs []int) error {
	var isActive bool
	checkQuery := `SELECT is_active FROM tests WHERE id = $1 AND is_deleted = false`
	err := r.db.QueryRow(checkQuery, testID).Scan(&isActive)
	if err != nil {
		return err
	}

	if isActive {
		return &TestError{Message: "Cannot modify order of questions in active test"}
	}

	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	deleteQuery := `DELETE FROM test_questions WHERE test_id = $1`
	_, err = tx.Exec(deleteQuery, testID)
	if err != nil {
		return err
	}

	for i, questionID := range questionIDs {
		insertQuery := `INSERT INTO test_questions (test_id, question_id, order_index) 
                        VALUES ($1, $2, $3)`
		_, err = tx.Exec(insertQuery, testID, questionID, i)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *TestRepository) GetDeleted() ([]models.Test, error) {
	query := `SELECT id, title, description, course_id, teacher_id, is_active, 
                     is_deleted, created_at 
              FROM tests WHERE is_deleted = true 
              ORDER BY created_at DESC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tests []models.Test
	for rows.Next() {
		var test models.Test
		err := rows.Scan(
			&test.ID,
			&test.Title,
			&test.Description,
			&test.CourseID,
			&test.TeacherID,
			&test.IsActive,
			&test.IsDeleted,
			&test.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		tests = append(tests, test)
	}
	return tests, nil
}

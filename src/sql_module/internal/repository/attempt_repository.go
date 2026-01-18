package repository

import (
	"database/sql"
	"sql_module/internal/models"
	"time"
)

type AttemptRepository struct {
	db *sql.DB
}

func NewAttemptRepository(db *sql.DB) *AttemptRepository {
	return &AttemptRepository{db: db}
}

type AttemptError struct {
	Message string
}

func (e *AttemptError) Error() string {
	return e.Message
}

func (r *AttemptRepository) StartAttempt(testID, userID int) (*models.Attempt, error) {
	var existingID int
	checkQuery := `SELECT id FROM attempts 
                   WHERE test_id = $1 AND user_id = $2 AND status = 'in_progress'`
	err := r.db.QueryRow(checkQuery, testID, userID).Scan(&existingID)

	if err == nil {
		return nil, &AttemptError{Message: "Active attempt already exists"}
	} else if err != sql.ErrNoRows {
		return nil, err
	}

	query := `INSERT INTO attempts (test_id, user_id, status, started_at) 
              VALUES ($1, $2, 'in_progress', CURRENT_TIMESTAMP) 
              RETURNING id, started_at`

	var attempt models.Attempt
	err = r.db.QueryRow(query, testID, userID).Scan(
		&attempt.ID,
		&attempt.StartedAt,
	)
	if err != nil {
		return nil, err
	}

	attempt.TestID = testID
	attempt.UserID = userID
	attempt.Status = "in_progress"

	return &attempt, nil
}

func (r *AttemptRepository) GetAttemptByID(id int) (*models.Attempt, error) {
	query := `SELECT id, test_id, user_id, status, score, started_at, completed_at
              FROM attempts WHERE id = $1`

	var attempt models.Attempt
	var score sql.NullFloat64
	var completedAt sql.NullTime

	err := r.db.QueryRow(query, id).Scan(
		&attempt.ID,
		&attempt.TestID,
		&attempt.UserID,
		&attempt.Status,
		&score,
		&attempt.StartedAt,
		&completedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if score.Valid {
		attempt.Score = &score.Float64
	}

	if completedAt.Valid {
		attempt.CompletedAt = &completedAt.Time
	}

	return &attempt, nil
}

func (r *AttemptRepository) GetUserAttempt(testID, userID int) (*models.Attempt, error) {
	query := `SELECT id, test_id, user_id, status, score, started_at, completed_at
              FROM attempts 
              WHERE test_id = $1 AND user_id = $2
              ORDER BY started_at DESC LIMIT 1`

	var attempt models.Attempt
	var score sql.NullFloat64
	var completedAt sql.NullTime

	err := r.db.QueryRow(query, testID, userID).Scan(
		&attempt.ID,
		&attempt.TestID,
		&attempt.UserID,
		&attempt.Status,
		&score,
		&attempt.StartedAt,
		&completedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if score.Valid {
		attempt.Score = &score.Float64
	}

	if completedAt.Valid {
		attempt.CompletedAt = &completedAt.Time
	}

	return &attempt, nil
}

// func (r *AttemptRepository) SubmitAnswer(attemptID, questionID, questionVersion, selectedOption int) (*models.Answer, error) {
// 	var status string
// 	checkQuery := `SELECT status FROM attempts WHERE id = $1`
// 	err := r.db.QueryRow(checkQuery, attemptID).Scan(&status)
// 	if err != nil {
// 		return nil, err
// 	}

// 	if status != "in_progress" {
// 		return nil, &AttemptError{Message: "Attempt is not in progress"}
// 	}

// 	var existingID int
// 	existingQuery := `SELECT id FROM attempt_answers
//                       WHERE attempt_id = $1 AND question_id = $2`
// 	err = r.db.QueryRow(existingQuery, attemptID, questionID).Scan(&existingID)

// 	var answerID int
// 	if err == sql.ErrNoRows {
// 		insertQuery := `INSERT INTO attempt_answers
//                         (attempt_id, question_id, question_version, selected_option, answered_at)
//                         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
//                         RETURNING id`
// 		err = r.db.QueryRow(insertQuery,
// 			attemptID, questionID, questionVersion, selectedOption).Scan(&answerID)
// 	} else if err == nil {
// 		updateQuery := `UPDATE attempt_answers
//                         SET selected_option = $1, answered_at = CURRENT_TIMESTAMP
//                         WHERE id = $2 RETURNING id`
// 		err = r.db.QueryRow(updateQuery, selectedOption, existingID).Scan(&answerID)
// 		answerID = existingID
// 	}

// 	if err != nil {
// 		return nil, err
// 	}

// 	var correctAnswer int
// 	var isCorrect sql.NullBool
// 	questionQuery := `SELECT correct_answer FROM questions WHERE id = $1`
// 	err = r.db.QueryRow(questionQuery, questionID).Scan(&correctAnswer)
// 	if err != nil {
// 		return nil, err
// 	}

// 	correct := selectedOption == correctAnswer
// 	isCorrect.Bool = correct
// 	isCorrect.Valid = true

// 	updateCorrectQuery := `UPDATE attempt_answers SET is_correct = $1 WHERE id = $2`
// 	_, err = r.db.Exec(updateCorrectQuery, correct, answerID)
// 	if err != nil {
// 		return nil, err
// 	}

// 	answer := &models.Answer{
// 		ID:              answerID,
// 		AttemptID:       attemptID,
// 		QuestionID:      questionID,
// 		QuestionVersion: questionVersion,
// 		SelectedOption:  selectedOption,
// 	}

// 	if isCorrect.Valid {
// 		answer.IsCorrect = &isCorrect.Bool
// 	}

// 	return answer, nil
// }

func (r *AttemptRepository) SubmitAnswer(attemptID, questionID, questionVersion, selectedOption int) (*models.Answer, error) {
	var status string
	checkQuery := `SELECT status FROM attempts WHERE id = $1`
	err := r.db.QueryRow(checkQuery, attemptID).Scan(&status)
	if err != nil {
		return nil, err
	}

	if status != "in_progress" {
		return nil, &AttemptError{Message: "Attempt is not in progress"}
	}

	var existingID int
	existingQuery := `SELECT id FROM attempt_answers 
                      WHERE attempt_id = $1 AND question_id = $2`
	err = r.db.QueryRow(existingQuery, attemptID, questionID).Scan(&existingID)

	var answerID int
	if err == sql.ErrNoRows {
		insertQuery := `INSERT INTO attempt_answers 
                        (attempt_id, question_id, question_version, selected_option, answered_at)
                        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                        RETURNING id`
		err = r.db.QueryRow(insertQuery,
			attemptID, questionID, questionVersion, selectedOption).Scan(&answerID)
	} else if err == nil {
		updateQuery := `UPDATE attempt_answers 
                        SET selected_option = $1, answered_at = CURRENT_TIMESTAMP
                        WHERE id = $2 RETURNING id`
		err = r.db.QueryRow(updateQuery, selectedOption, existingID).Scan(&answerID)
		answerID = existingID
	}

	if err != nil {
		return nil, err
	}

	// ИСПРАВЛЕНО: Используем correct_option вместо correct_answer
	var correctOption int
	questionQuery := `SELECT correct_option FROM questions WHERE id = $1 AND version = $2`
	err = r.db.QueryRow(questionQuery, questionID, questionVersion).Scan(&correctOption)
	if err != nil {
		return nil, err
	}

	correct := selectedOption == correctOption

	// ИСПРАВЛЕНО: Обновляем правильность ответа
	updateCorrectQuery := `UPDATE attempt_answers 
                          SET correct_answer = $1, is_correct = $1 
                          WHERE id = $2`
	_, err = r.db.Exec(updateCorrectQuery, correct, answerID)
	if err != nil {
		return nil, err
	}

	answer := &models.Answer{
		ID:              answerID,
		AttemptID:       attemptID,
		QuestionID:      questionID,
		QuestionVersion: questionVersion,
		SelectedOption:  selectedOption,
		IsCorrect:       &correct, // Добавляем информацию о правильности
	}

	return answer, nil
}

func (r *AttemptRepository) CompleteAttempt(attemptID int) (*models.Attempt, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var testID, userID int
	var status string
	checkQuery := `SELECT test_id, user_id, status FROM attempts WHERE id = $1 FOR UPDATE`
	err = tx.QueryRow(checkQuery, attemptID).Scan(&testID, &userID, &status)
	if err != nil {
		return nil, err
	}

	if status != "in_progress" {
		return nil, &AttemptError{Message: "Attempt is not in progress"}
	}

	var totalScore, maxScore float64
	scoreQuery := `
        SELECT 
            COALESCE(SUM(CASE WHEN aa.is_correct = true THEN q.points ELSE 0 END), 0) as total_score,
            COALESCE(SUM(q.points), 0) as max_score
        FROM attempt_answers aa
        JOIN questions q ON aa.question_id = q.id
        WHERE aa.attempt_id = $1`

	err = tx.QueryRow(scoreQuery, attemptID).Scan(&totalScore, &maxScore)
	if err != nil {
		return nil, err
	}

	updateQuery := `UPDATE attempts 
                    SET status = 'completed', score = $1, completed_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING completed_at`

	var completedAt time.Time
	err = tx.QueryRow(updateQuery, totalScore, attemptID).Scan(&completedAt)
	if err != nil {
		return nil, err
	}

	var attempt models.Attempt
	var score sql.NullFloat64
	var completedAtNull sql.NullTime

	getQuery := `SELECT id, test_id, user_id, status, score, started_at, completed_at
                 FROM attempts WHERE id = $1`

	err = tx.QueryRow(getQuery, attemptID).Scan(
		&attempt.ID,
		&attempt.TestID,
		&attempt.UserID,
		&attempt.Status,
		&score,
		&attempt.StartedAt,
		&completedAtNull,
	)

	if err != nil {
		return nil, err
	}

	if score.Valid {
		attempt.Score = &score.Float64
	}

	if completedAtNull.Valid {
		attempt.CompletedAt = &completedAtNull.Time
	}

	resultQuery := `INSERT INTO test_results (test_id, user_id, score, max_score, completed_at)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (test_id, user_id) DO UPDATE 
                    SET score = EXCLUDED.score, completed_at = EXCLUDED.completed_at`

	_, err = tx.Exec(resultQuery, testID, userID, totalScore, maxScore, completedAt)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return &attempt, nil
}

func (r *AttemptRepository) GetAttemptAnswers(attemptID int) ([]models.Answer, error) {
	query := `SELECT id, attempt_id, question_id, question_version, selected_option, is_correct
              FROM attempt_answers 
              WHERE attempt_id = $1
              ORDER BY id`

	rows, err := r.db.Query(query, attemptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var answers []models.Answer
	for rows.Next() {
		var answer models.Answer
		var isCorrect sql.NullBool

		err := rows.Scan(
			&answer.ID,
			&answer.AttemptID,
			&answer.QuestionID,
			&answer.QuestionVersion,
			&answer.SelectedOption,
			&isCorrect,
		)
		if err != nil {
			return nil, err
		}

		if isCorrect.Valid {
			answer.IsCorrect = &isCorrect.Bool
		}

		answers = append(answers, answer)
	}

	return answers, nil
}

// GetTestResults получает результаты теста (для преподавателя)
func (r *AttemptRepository) GetTestResults(testID int) ([]models.Attempt, error) {
	query := `SELECT a.id, a.test_id, a.user_id, a.status, a.score, 
                     a.started_at, a.completed_at, u.full_name
              FROM attempts a
              JOIN users u ON a.user_id = u.id
              WHERE a.test_id = $1 AND a.status = 'completed'
              ORDER BY a.score DESC, a.completed_at`

	rows, err := r.db.Query(query, testID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attempts []models.Attempt
	for rows.Next() {
		var attempt models.Attempt
		var score sql.NullFloat64
		var completedAt sql.NullTime
		var fullName string

		err := rows.Scan(
			&attempt.ID,
			&attempt.TestID,
			&attempt.UserID,
			&attempt.Status,
			&score,
			&attempt.StartedAt,
			&completedAt,
			&fullName,
		)
		if err != nil {
			return nil, err
		}

		if score.Valid {
			attempt.Score = &score.Float64
		}

		if completedAt.Valid {
			attempt.CompletedAt = &completedAt.Time
		}

		attempts = append(attempts, attempt)
	}

	return attempts, nil
}

func (r *AttemptRepository) CancelAttempt(attemptID int) error {
	query := `UPDATE attempts SET status = 'cancelled' WHERE id = $1 AND status = 'in_progress'`
	result, err := r.db.Exec(query, attemptID)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return &AttemptError{Message: "Attempt not found or not in progress"}
	}

	return nil
}

func (r *AttemptRepository) CompleteAllAttemptsForTest(testID int) error {
	query := `
        UPDATE attempts 
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE test_id = $1 AND status = 'in_progress'
        RETURNING id
    `

	rows, err := r.db.Query(query, testID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var attemptIDs []int
	for rows.Next() {
		var attemptID int
		if err := rows.Scan(&attemptID); err != nil {
			return err
		}
		attemptIDs = append(attemptIDs, attemptID)
	}

	// TODO: можно добавить отправку уведомлений пользователям
	// о принудительном завершении попыток, но мне что-то лень :)

	return nil
}

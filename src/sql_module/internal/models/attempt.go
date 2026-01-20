package models

import (
	"time"
)

type Attempt struct {
	ID          int        `json:"id"`
	TestID      int        `json:"test_id"`
	UserID      int        `json:"user_id"`
	Status      string     `json:"status"` // могут быть : in_progress, completed, cancelled
	Score       *float64   `json:"score"`  // nil = еще не прошел
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"` // nil - еще не прошел
}

type Answer struct {
	ID              int   `json:"id"`
	AttemptID       int   `json:"attempt_id"`
	QuestionID      int   `json:"question_id"`
	QuestionVersion int   `json:"question_version"`
	SelectedOption  int   `json:"selected_option"`
	IsCorrect       *bool `json:"is_correct"` // nil - не проверено
}

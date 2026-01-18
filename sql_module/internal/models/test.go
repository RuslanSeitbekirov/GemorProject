package models

import (
	"time"
)

type Test struct {
	ID             int       `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	CourseID       int       `json:"course_id"`
	TeacherID      int       `json:"teacher_id"`
	IsActive       bool      `json:"is_active"`
	IsDeleted      bool      `json:"is_deleted"`
	CreatedAt      time.Time `json:"created_at"`
	QuestionIDs    []int     `json:"question_ids,omitempty"`    // Массив ID вопросов в порядке
	QuestionsCount int       `json:"questions_count,omitempty"` // Количество вопросов (число)
}

type TestQuestion struct {
	ID         int `json:"id"`
	TestID     int `json:"test_id"`
	QuestionID int `json:"question_id"`
	OrderIndex int `json:"order_index"`
}

package models

import "time"

type Course struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	TeacherID   int       `json:"teacher_id"`
	IsActive    bool      `json:"is_active"`
	IsDeleted   bool      `json:"is_deleted"`
	CreatedAt   time.Time `json:"created_at"`
}

type CourseEnrollment struct {
	CourseID int    `json:"course_id"`
	UserID   int    `json:"user_id"`
	Role     string `json:"role"` // или student или teacher
}

package models

import "time"

type Notification struct {
	ID        int        `json:"id"`
	UserID    int        `json:"user_id"`
	Type      string     `json:"type"` // "test_started", "test_completed", "course_enrolled"
	Title     string     `json:"title"`
	Message   string     `json:"message"`
	Data      string     `json:"data"` // доп данные
	IsRead    bool       `json:"is_read"`
	CreatedAt time.Time  `json:"created_at"`
	ReadAt    *time.Time `json:"read_at"` // nil если не прочитано
}

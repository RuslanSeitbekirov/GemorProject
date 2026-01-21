package models

import "time"

type Question struct {
	ID            int       `json:"id"`
	Title         string    `json:"title"`
	Text          string    `json:"text"`
	Options       []string  `json:"options"`        // ["Вариант 1", "Вариант 2"]
	CorrectOption int       `json:"correct_option"` // 0 или 1
	Points        int       `json:"points"`
	AuthorID      int       `json:"author_id"`
	Version       int       `json:"version"`
	IsDeleted     bool      `json:"is_deleted"`
	CreatedAt     time.Time `json:"created_at"`
}

package repository

import (
	"database/sql"
	"sql_module/internal/models"
	"time"
)

type NotificationRepository struct {
	db *sql.DB
}

func NewNotificationRepository(db *sql.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

func (r *NotificationRepository) Create(notification *models.Notification) error {
	query := `
		INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	err := r.db.QueryRow(query,
		notification.UserID,
		notification.Type,
		notification.Title,
		notification.Message,
		notification.Data,
		notification.IsRead,
		notification.CreatedAt,
	).Scan(&notification.ID)

	return err
}

func (r *NotificationRepository) GetByUserID(userID int) ([]models.Notification, error) {
	query := `
		SELECT id, user_id, type, title, message, data, is_read, created_at, read_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []models.Notification
	for rows.Next() {
		var n models.Notification
		err := rows.Scan(
			&n.ID,
			&n.UserID,
			&n.Type,
			&n.Title,
			&n.Message,
			&n.Data,
			&n.IsRead,
			&n.CreatedAt,
			&n.ReadAt,
		)
		if err != nil {
			return nil, err
		}
		notifications = append(notifications, n)
	}

	return notifications, nil
}

func (r *NotificationRepository) MarkAsRead(notificationID, userID int) error {
	query := `
		UPDATE notifications
		SET is_read = TRUE, read_at = $1
		WHERE id = $2 AND user_id = $3
	`
	_, err := r.db.Exec(query, time.Now(), notificationID, userID)
	return err
}

func (r *NotificationRepository) MarkAllAsRead(userID int) error {
	query := `
		UPDATE notifications
		SET is_read = TRUE, read_at = $1
		WHERE user_id = $2 AND is_read = FALSE
	`
	_, err := r.db.Exec(query, time.Now(), userID)
	return err
}

func (r *NotificationRepository) Delete(notificationID, userID int) error {
	query := `DELETE FROM notifications WHERE id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, notificationID, userID)
	return err
}

func (r *NotificationRepository) DeleteAll(userID int) error {
	query := `DELETE FROM notifications WHERE user_id = $1`
	_, err := r.db.Exec(query, userID)
	return err
}

func (r *NotificationRepository) GetUnreadCount(userID int) (int, error) {
	query := `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`
	var count int
	err := r.db.QueryRow(query, userID).Scan(&count)
	return count, err
}

package repository

import (
	"database/sql"
	"fmt"
	"sql_module/internal/models"

	"golang.org/x/crypto/bcrypt"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func (r *UserRepository) Create(user *models.User) error {
	query := `INSERT INTO users (full_name, email, password_hash) 
	          VALUES ($1, $2, $3) RETURNING id, created_at`

	hashedPassword, err := HashPassword(user.PasswordHash)
	if err != nil {
		return err
	}

	return r.db.QueryRow(query,
		user.FullName,
		user.Email,
		hashedPassword,
	).Scan(&user.ID, &user.CreatedAt)
}

func (r *UserRepository) GetByEmail(email string) (*models.User, error) {
	query := `SELECT id, full_name, email, is_blocked, created_at 
	          FROM users WHERE email = $1`

	var user models.User
	err := r.db.QueryRow(query, email).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.IsBlocked,
		&user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) CheckPassword(email, password string) (bool, error) {
	query := `SELECT password_hash FROM users WHERE email = $1`
	var hashedPassword string

	err := r.db.QueryRow(query, email).Scan(&hashedPassword)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	return CheckPasswordHash(password, hashedPassword), nil
}

func (r *UserRepository) GetUserRoles(userID int) ([]string, error) {
	query := `SELECT role FROM user_roles WHERE user_id = $1`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []string
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}

	return roles, nil
}

func (r *UserRepository) UpdateUserRoles(userID int, roles []string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec("DELETE FROM user_roles WHERE user_id = $1", userID)
	if err != nil {
		return err
	}

	for _, role := range roles {
		if role != "student" && role != "teacher" && role != "admin" {
			return fmt.Errorf("invalid role: %s", role)
		}

		_, err = tx.Exec(
			"INSERT INTO user_roles (user_id, role) VALUES ($1, $2)",
			userID, role,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *UserRepository) AddUserRole(userID int, role string) error {
	query := `INSERT INTO user_roles (user_id, role) VALUES ($1, $2) 
	          ON CONFLICT (user_id, role) DO NOTHING`
	_, err := r.db.Exec(query, userID, role)
	return err
}

func (r *UserRepository) GetByID(id int) (*models.User, error) {
	query := `SELECT id, full_name, email, is_blocked, created_at 
	          FROM users WHERE id = $1`

	var user models.User
	err := r.db.QueryRow(query, id).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.IsBlocked,
		&user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

func (r *UserRepository) BlockUser(userID int) error {
	query := `UPDATE users SET is_blocked = true WHERE id = $1`
	_, err := r.db.Exec(query, userID)
	return err
}

func (r *UserRepository) UnblockUser(userID int) error {
	query := `UPDATE users SET is_blocked = false WHERE id = $1`
	_, err := r.db.Exec(query, userID)
	return err
}

func (r *UserRepository) GetBlockStatus(userID int) (bool, error) {
	var isBlocked bool
	query := `SELECT is_blocked FROM users WHERE id = $1`
	err := r.db.QueryRow(query, userID).Scan(&isBlocked)
	if err != nil {
		return false, err
	}
	return isBlocked, nil
}

func (r *UserRepository) CountAdmins() (int, error) {
	var count int
	query := `SELECT COUNT(DISTINCT user_id) FROM user_roles WHERE role = 'admin'`
	err := r.db.QueryRow(query).Scan(&count)
	return count, err
}

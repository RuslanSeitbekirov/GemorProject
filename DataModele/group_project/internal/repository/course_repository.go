package repository

import (
	"database/sql"
	"sql_module/internal/models"
)

type CourseRepository struct {
	db *sql.DB
}

func NewCourseRepository(db *sql.DB) *CourseRepository {
	return &CourseRepository{db: db}
}

func (r *CourseRepository) GetAll() ([]models.Course, error) {
	query := `SELECT id, name, description, teacher_id, is_active, is_deleted, created_at 
              FROM courses WHERE is_deleted = false`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courses []models.Course
	for rows.Next() {
		var course models.Course
		err := rows.Scan(
			&course.ID,
			&course.Name,
			&course.Description,
			&course.TeacherID,
			&course.IsActive,
			&course.IsDeleted,
			&course.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		courses = append(courses, course)
	}
	return courses, nil
}

func (r *CourseRepository) GetByID(id int) (*models.Course, error) {
	query := `SELECT id, name, description, teacher_id, is_active, is_deleted, created_at 
              FROM courses WHERE id = $1 AND is_deleted = false`
	row := r.db.QueryRow(query, id)

	var course models.Course
	err := row.Scan(
		&course.ID,
		&course.Name,
		&course.Description,
		&course.TeacherID,
		&course.IsActive,
		&course.IsDeleted,
		&course.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &course, nil
}

func (r *CourseRepository) Create(course *models.Course) error {
	query := `INSERT INTO courses (name, description, teacher_id, is_active) 
              VALUES ($1, $2, $3, $4) RETURNING id, created_at`
	err := r.db.QueryRow(query, course.Name, course.Description, course.TeacherID, course.IsActive).
		Scan(&course.ID, &course.CreatedAt)
	return err
}

func (r *CourseRepository) Update(course *models.Course) error {
	query := `UPDATE courses SET name = $1, description = $2, teacher_id = $3, 
              is_active = $4 WHERE id = $5 AND is_deleted = false`
	result, err := r.db.Exec(query, course.Name, course.Description, course.TeacherID,
		course.IsActive, course.ID)
	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *CourseRepository) Delete(id int) error {
	query := `UPDATE courses SET is_deleted = true WHERE id = $1`
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

func (r *CourseRepository) EnrollStudent(courseID, userID int) error {
	query := `INSERT INTO course_enrollments (course_id, user_id, role) 
              VALUES ($1, $2, 'student') 
              ON CONFLICT (course_id, user_id) DO NOTHING`
	_, err := r.db.Exec(query, courseID, userID)
	return err
}

func (r *CourseRepository) UnenrollStudent(courseID, userID int) error {
	query := `DELETE FROM course_enrollments 
              WHERE course_id = $1 AND user_id = $2 AND role = 'student'`
	_, err := r.db.Exec(query, courseID, userID)
	return err
}

func (r *CourseRepository) GetCourseStudents(courseID int) ([]models.User, error) {
	query := `SELECT u.id, u.full_name, u.email, u.is_blocked, u.created_at
              FROM users u
              JOIN course_enrollments ce ON u.id = ce.user_id
              WHERE ce.course_id = $1 AND ce.role = 'student'`

	rows, err := r.db.Query(query, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(
			&user.ID,
			&user.FullName,
			&user.Email,
			&user.IsBlocked,
			&user.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}

	return users, nil
}

func (r *CourseRepository) IsStudentEnrolled(courseID, userID int) (bool, error) {
	query := `SELECT EXISTS(
                SELECT 1 FROM course_enrollments 
                WHERE course_id = $1 AND user_id = $2 AND role = 'student'
              )`
	var exists bool
	err := r.db.QueryRow(query, courseID, userID).Scan(&exists)
	return exists, err
}

func (r *CourseRepository) GetStudentCourses(userID int) ([]models.Course, error) {
	query := `SELECT c.id, c.name, c.description, c.teacher_id, c.is_active, 
                     c.is_deleted, c.created_at
              FROM courses c
              JOIN course_enrollments ce ON c.id = ce.course_id
              WHERE ce.user_id = $1 AND ce.role = 'student' 
                AND c.is_deleted = false`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courses []models.Course
	for rows.Next() {
		var course models.Course
		err := rows.Scan(
			&course.ID,
			&course.Name,
			&course.Description,
			&course.TeacherID,
			&course.IsActive,
			&course.IsDeleted,
			&course.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		courses = append(courses, course)
	}

	return courses, nil
}

func (r *CourseRepository) Restore(id int) error {
	query := `UPDATE courses SET is_deleted = false WHERE id = $1`
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

func (r *CourseRepository) GetDeleted() ([]models.Course, error) {
	query := `SELECT id, name, description, teacher_id, is_active, is_deleted, created_at 
              FROM courses WHERE is_deleted = true`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courses []models.Course
	for rows.Next() {
		var course models.Course
		err := rows.Scan(
			&course.ID,
			&course.Name,
			&course.Description,
			&course.TeacherID,
			&course.IsActive,
			&course.IsDeleted,
			&course.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		courses = append(courses, course)
	}
	return courses, nil
}

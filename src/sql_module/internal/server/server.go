package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sql_module/internal/auth"
	"sql_module/internal/models"
	"sql_module/internal/repository"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

type Server struct {
	router           *mux.Router
	db               *sql.DB
	userRepo         *repository.UserRepository
	courseRepo       *repository.CourseRepository
	testRepo         *repository.TestRepository
	attemptRepo      *repository.AttemptRepository
	questionRepo     *repository.QuestionRepository
	notificationRepo *repository.NotificationRepository
	blockMiddleware  *auth.BlockMiddleware
}

func NewServer(db *sql.DB) *Server {
	s := &Server{
		router:           mux.NewRouter(),
		db:               db,
		userRepo:         repository.NewUserRepository(db),
		courseRepo:       repository.NewCourseRepository(db),
		testRepo:         repository.NewTestRepository(db),
		attemptRepo:      repository.NewAttemptRepository(db),
		questionRepo:     repository.NewQuestionRepository(db),
		notificationRepo: repository.NewNotificationRepository(db),
	}

	s.configureRouter()

	s.blockMiddleware = auth.NewBlockMiddleware(s.userRepo)

	s.router.Use(auth.JWTMiddleware)
	s.router.Use(s.blockMiddleware.Middleware)

	return s
}

func (s *Server) configureRouter() {
	api := s.router.PathPrefix("/api").Subrouter()
	api.Use(auth.JWTMiddleware)

	s.router.HandleFunc("/health", s.handleHealthCheck).Methods("GET")
	// пользователи
	s.router.HandleFunc("/api/users", s.handleGetUsers).Methods("GET")
	s.router.HandleFunc("/api/users/{id}", s.handleGetUser).Methods("GET")
	s.router.HandleFunc("/api/users", s.handleCreateUser).Methods("POST")
	// блокировка/роли пользователей
	api.HandleFunc("/users/{id}/block", s.handleBlockUser).Methods("POST")
	api.HandleFunc("/users/{id}/unblock", s.handleUnblockUser).Methods("POST")
	api.HandleFunc("/users/{id}/block-status", s.handleGetBlockStatus).Methods("GET")
	api.HandleFunc("/users/{id}/roles", s.handleGetUserRoles).Methods("GET")
	api.HandleFunc("/users/{id}/roles", s.handleUpdateUserRoles).Methods("PUT")

	// курсы
	s.router.HandleFunc("/api/courses", s.handleGetCourses).Methods("GET")
	s.router.HandleFunc("/api/courses/{id}", s.handleGetCourse).Methods("GET")
	s.router.HandleFunc("/api/courses/{id}", s.handleUpdateCourse).Methods("PUT")
	s.router.HandleFunc("/api/courses/{id}", s.handleDeleteCourse).Methods("DELETE")
	s.router.HandleFunc("/api/courses", s.handleCreateCourse).Methods("POST")
	s.router.HandleFunc("/api/courses/{id}/tests", s.handleGetCourseTests).Methods("GET")

	s.router.HandleFunc("/api/login", s.handleLogin).Methods("POST")
	s.router.HandleFunc("/api/register", s.handleRegister).Methods("POST")
	// тесты и попытки
	api.HandleFunc("/tests/{test_id}/start", s.handleStartAttempt).Methods("POST")
	api.HandleFunc("/attempts/{attempt_id}", s.handleGetAttempt).Methods("GET")
	api.HandleFunc("/attempts/{attempt_id}/answer", s.handleSubmitAnswer).Methods("POST")
	api.HandleFunc("/attempts/{attempt_id}/complete", s.handleCompleteAttempt).Methods("POST")
	api.HandleFunc("/attempts/{attempt_id}/cancel", s.handleCancelAttempt).Methods("POST")
	api.HandleFunc("/tests/{id}", s.handleDeleteTest).Methods("DELETE")
	api.HandleFunc("/tests/{id}/restore", s.handleRestoreTest).Methods("POST")
	api.HandleFunc("/tests/deleted", s.handleGetDeletedTests).Methods("GET")
	api.HandleFunc("/attempts/{attempt_id}/answers", s.handleGetAttemptAnswers).Methods("GET")
	api.HandleFunc("/tests/{test_id}/results", s.handleGetTestResults).Methods("GET")
	// управление порядком вопросов в тесте
	api.HandleFunc("/tests/{test_id}/questions/order", s.handleUpdateQuestionOrder).Methods("PUT")
	api.HandleFunc("/tests/{test_id}/questions/order", s.handleGetQuestionOrder).Methods("GET")

	// управление тестами
	api.HandleFunc("/tests", s.handleCreateTest).Methods("POST")
	api.HandleFunc("/tests/{test_id}/questions", s.handleAddQuestionToTest).Methods("POST")
	api.HandleFunc("/tests", s.handleGetTests).Methods("GET")
	api.HandleFunc("/tests/{id}", s.handleGetTest).Methods("GET")

	// активация/деактивация теста
	s.router.HandleFunc("/api/tests/{id}/activate", s.handleActivateTest).Methods("POST")
	s.router.HandleFunc("/api/tests/{id}/deactivate", s.handleDeactivateTest).Methods("POST")

	// вопросы
	api.HandleFunc("/questions", s.handleCreateQuestion).Methods("POST")
	api.HandleFunc("/my/questions", s.handleGetMyQuestions).Methods("GET")
	api.HandleFunc("/questions/deleted", s.handleGetDeletedQuestions).Methods("GET")

	api.HandleFunc("/questions/{id}", s.handleGetQuestion).Methods("GET")
	api.HandleFunc("/questions/{id}", s.handleUpdateQuestion).Methods("PUT")
	api.HandleFunc("/questions/{id}", s.handleDeleteQuestion).Methods("DELETE")
	api.HandleFunc("/questions/{id}/restore", s.handleRestoreQuestion).Methods("POST")
	api.HandleFunc("/questions/{id}/versions", s.handleGetQuestionVersions).Methods("GET")

	// Уведомления
	api.HandleFunc("/notifications", s.handleGetNotifications).Methods("GET")
	api.HandleFunc("/notifications/read/all", s.handleMarkAllNotificationsAsRead).Methods("POST")
	api.HandleFunc("/notifications/unread/count", s.handleGetUnreadCount).Methods("GET")
	api.HandleFunc("/notifications/test", s.handleCreateTestNotification).Methods("POST")
	api.HandleFunc("/notifications", s.handleDeleteAllNotifications).Methods("DELETE")
	api.HandleFunc("/notifications/{id}/read", s.handleMarkNotificationAsRead).Methods("POST")
	api.HandleFunc("/notifications/{id}", s.handleDeleteNotification).Methods("DELETE")

	// управление участниками на курсе
	s.router.HandleFunc("/api/courses/{id}/students", s.handleGetCourseStudents).Methods("GET")
	s.router.HandleFunc("/api/courses/{id}/students/{user_id}", s.handleEnrollStudent).Methods("POST")
	s.router.HandleFunc("/api/courses/{id}/students/{user_id}", s.handleUnenrollStudent).Methods("DELETE")
	// мягкие удаления и восстановления
	api.HandleFunc("/questions/deleted", s.handleGetDeletedQuestions).Methods("GET")
	api.HandleFunc("/courses/{id}/restore", s.handleRestoreCourse).Methods("POST")
	api.HandleFunc("/courses/deleted", s.handleGetDeletedCourses).Methods("GET")
	api.HandleFunc("/tests/{id}/restore", s.handleRestoreTest).Methods("POST")
	api.HandleFunc("/tests/deleted", s.handleGetDeletedTests).Methods("GET")
	api.HandleFunc("/questions/{id}/restore", s.handleRestoreQuestion).Methods("POST")
	api.HandleFunc("/questions/{id}/versions", s.handleGetQuestionVersions).Methods("GET")

}

// обработчики
func (s *Server) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleGetUsers(w http.ResponseWriter, r *http.Request) {
	users := []models.User{
		{ID: 1, FullName: "Тест", Email: "test@email.com"},
	}

	respondWithJSON(w, http.StatusOK, users)
}

// canModifyCourse проверяет, может ли пользователь модифицировать курс
func (s *Server) canModifyCourse(userClaims *auth.Claims, course *models.Course, requiredGeneralPerm, requiredOwnPerm string) bool {
	hasGeneralPermission := auth.HasPermission(userClaims, requiredGeneralPerm)
	hasOwnPermission := auth.HasPermission(userClaims, requiredOwnPerm)

	if hasGeneralPermission {
		return true // Админ имеет доступ ко всему
	}

	if hasOwnPermission {
		return course.TeacherID == userClaims.UserID // Преподаватель только своих курсов
	}

	return false
}

// canViewCourse проверяет, может ли пользователь просматривать курс
func (s *Server) canViewCourse(userClaims *auth.Claims, course *models.Course) bool {
	// Админ может всё
	if auth.HasPermission(userClaims, "course:info:write") {
		return true
	}

	// Преподаватель может просматривать свои курсы
	if auth.HasPermission(userClaims, "course:info:write:own") && course.TeacherID == userClaims.UserID {
		return true
	}

	// Студент может просматривать курсы, на которые записан
	// TODO: добавить проверку enrollment
	return false
}

// canModifyQuestion проверяет, может ли пользователь модифицировать вопрос
func (s *Server) canModifyQuestion(userClaims *auth.Claims, question *models.Question) bool {
	hasGeneralPermission := auth.HasPermission(userClaims, "course:test:write")
	hasOwnPermission := auth.HasPermission(userClaims, "course:test:write:own")

	if hasGeneralPermission {
		return true // Админ имеет доступ ко всему
	}

	if hasOwnPermission {
		return question.AuthorID == userClaims.UserID // Автор только своих вопросов
	}

	return false
}

// canViewQuestion проверяет, может ли пользователь просматривать вопрос
func (s *Server) canViewQuestion(userClaims *auth.Claims, question *models.Question) bool {
	// Админ может всё
	if auth.HasPermission(userClaims, "course:test:write") {
		return true
	}

	// Автор может просматривать свои вопросы
	if question.AuthorID == userClaims.UserID {
		return true
	}

	// TODO: студент может просматривать вопросы из тестов, которые проходит
	return false
}

// Обработчики для курсов
func (s *Server) handleGetCourses(w http.ResponseWriter, r *http.Request) {
	courses, err := s.courseRepo.GetAll()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, courses)
}

func (s *Server) handleGetCourse(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid course ID")
		return
	}

	course, err := s.courseRepo.GetByID(id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if course == nil {
		respondWithError(w, http.StatusNotFound, "Course not found")
		return
	}

	respondWithJSON(w, http.StatusOK, course)
}

func (s *Server) handleUpdateCourse(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid course ID")
		return
	}

	// Проверяем существование курса
	existingCourse, err := s.courseRepo.GetByID(id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if existingCourse == nil {
		respondWithError(w, http.StatusNotFound, "Course not found")
		return
	}

	// Получаем ID пользователя из JWT токена
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Проверяем права с использованием permission system
	if !s.canModifyCourse(userClaims, existingCourse, "course:info:write", "course:info:write:own") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to edit this course")
		return
	}

	var updates models.Course
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// Обновляем только разрешенные поля
	existingCourse.Name = updates.Name
	existingCourse.Description = updates.Description

	if err := s.courseRepo.Update(existingCourse); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, existingCourse)
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var request struct {
		FullName string `json:"full_name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// Валидация
	if request.FullName == "" || request.Email == "" || request.Password == "" {
		respondWithError(w, http.StatusBadRequest, "All fields are required")
		return
	}

	// Проверяем, не существует ли уже пользователь
	existingUser, err := s.userRepo.GetByEmail(request.Email)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if existingUser != nil {
		respondWithError(w, http.StatusBadRequest, "User with this email already exists")
		return
	}

	// Создаем пользователя
	user := &models.User{
		FullName:     request.FullName,
		Email:        request.Email,
		PasswordHash: request.Password,
	}

	if err := s.userRepo.Create(user); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Определяем роль: если не указана или не "admin"/"teacher" - ставим "student"
	role := "student"
	if request.Role == "teacher" || request.Role == "admin" {
		role = request.Role
	}

	if err := s.userRepo.AddUserRole(user.ID, role); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not assign role")
		return
	}

	// Очищаем пароль в ответе
	user.PasswordHash = ""
	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"user": user,
		"role": role,
	})
}

func (s *Server) handleDeleteCourse(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid course ID")
		return
	}

	existingCourse, err := s.courseRepo.GetByID(id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if existingCourse == nil {
		respondWithError(w, http.StatusNotFound, "Course not found")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "course:del") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to delete courses")
		return
	}

	if err := s.courseRepo.Delete(id); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Course deleted successfully"})
}

func (s *Server) handleRestoreCourse(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	courseID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid course ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "course:del") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to restore courses")
		return
	}

	existingCourse, err := s.courseRepo.GetByID(courseID)
	if err != nil && err != sql.ErrNoRows {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if existingCourse == nil {
		var exists bool
		checkQuery := `SELECT EXISTS(SELECT 1 FROM courses WHERE id = $1)`
		err := s.db.QueryRow(checkQuery, courseID).Scan(&exists)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !exists {
			respondWithError(w, http.StatusNotFound, "Course not found")
			return
		}
	}

	if err := s.courseRepo.Restore(courseID); err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Course not found")
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Course restored successfully",
	})
}

func (s *Server) handleGetDeletedCourses(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "course:del") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to view deleted courses")
		return
	}

	courses, err := s.courseRepo.GetDeleted()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, courses)
}

func (s *Server) handleRestoreTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "course:test:write") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to restore tests")
		return
	}

	test, err := s.testRepo.GetByID(testID)
	if err != nil && err != sql.ErrNoRows {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if test != nil && !test.IsDeleted {
		respondWithError(w, http.StatusBadRequest, "Test is not deleted")
		return
	}

	if err := s.testRepo.Restore(testID); err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Test not found")
		} else if testErr, ok := err.(*repository.TestError); ok {
			respondWithError(w, http.StatusBadRequest, testErr.Message)
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Test restored successfully",
	})
}

func (s *Server) handleRestoreQuestion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	questionID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid question ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	existingQuestion, err := s.questionRepo.GetByID(questionID)
	if err != nil && err != sql.ErrNoRows {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if existingQuestion != nil && !existingQuestion.IsDeleted {
		respondWithError(w, http.StatusBadRequest, "Question is not deleted")
		return
	}

	if existingQuestion != nil && !s.canModifyQuestion(userClaims, existingQuestion) {
		if !auth.HasPermission(userClaims, "course:test:write") {
			respondWithError(w, http.StatusForbidden, "You don't have permission to restore this question")
			return
		}
	}

	if err := s.questionRepo.Restore(questionID); err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Question not found")
		} else if qErr, ok := err.(*repository.QuestionError); ok {
			respondWithError(w, http.StatusBadRequest, qErr.Message)
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Question restored successfully",
	})
}

func (s *Server) handleDeleteTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	test, err := s.testRepo.GetByID(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if test == nil {
		respondWithError(w, http.StatusNotFound, "Test not found")
		return
	}

	if !s.canModifyCourse(userClaims, &models.Course{
		ID:        test.CourseID,
		TeacherID: test.TeacherID,
	}, "course:test:write", "course:test:write:own") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to delete this test")
		return
	}

	if err := s.testRepo.Delete(testID); err != nil {
		if testErr, ok := err.(*repository.TestError); ok {
			respondWithError(w, http.StatusBadRequest, testErr.Message)
		} else if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Test not found")
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Test deleted successfully",
	})
}

func (s *Server) handleGetDeletedTests(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "course:test:write") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to view deleted tests")
		return
	}

	tests, err := s.testRepo.GetDeleted()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, tests)
}

func (s *Server) handleGetCourseStudents(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	courseID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid course ID")
		return
	}

	course, err := s.courseRepo.GetByID(courseID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if course == nil {
		respondWithError(w, http.StatusNotFound, "Course not found")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	canView := false
	if auth.HasPermission(userClaims, "course:student:read") {
		canView = true
	} else if auth.HasPermission(userClaims, "course:student:read:own") {
		if course.TeacherID == userClaims.UserID {
			canView = true
		}
	}

	if !canView {
		respondWithError(w, http.StatusForbidden, "You don't have permission to view course students")
		return
	}

	students, err := s.courseRepo.GetCourseStudents(courseID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	for i := range students {
		students[i].PasswordHash = ""
	}

	respondWithJSON(w, http.StatusOK, students)
}

func (s *Server) handleGetDeletedQuestions(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "course:test:write") {
		if !auth.HasPermission(userClaims, "course:test:write:own") {
			respondWithError(w, http.StatusForbidden, "You don't have permission to view deleted questions")
			return
		}

		questions, err := s.questionRepo.GetDeleted()
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		var myQuestions []models.Question
		for _, q := range questions {
			if q.AuthorID == userClaims.UserID {
				myQuestions = append(myQuestions, q)
			}
		}

		respondWithJSON(w, http.StatusOK, myQuestions)
		return
	}

	questions, err := s.questionRepo.GetDeleted()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, questions)
}

func (s *Server) handleEnrollStudent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	courseID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid course ID")
		return
	}

	userID, err := strconv.Atoi(vars["user_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Проверяем существование курса
	course, err := s.courseRepo.GetByID(courseID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if course == nil {
		respondWithError(w, http.StatusNotFound, "Course not found")
		return
	}

	// Проверяем существование пользователя
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	// Проверяем, не заблокирован ли пользователь
	if user.IsBlocked {
		respondWithError(w, http.StatusBadRequest, "User is blocked")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	canEnroll := false
	if auth.HasPermission(userClaims, "course:student:write") {
		canEnroll = true // Админ может записывать в любой курс
	} else if auth.HasPermission(userClaims, "course:student:write:own") {
		// Преподаватель может записывать только в свои курсы
		if course.TeacherID == userClaims.UserID {
			canEnroll = true
		}
	}

	if !canEnroll {
		respondWithError(w, http.StatusForbidden, "You don't have permission to enroll students")
		return
	}

	// Проверяем, не записан ли уже студент
	enrolled, err := s.courseRepo.IsStudentEnrolled(courseID, userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if enrolled {
		respondWithError(w, http.StatusConflict, "Student is already enrolled in this course")
		return
	}

	// Записываем студента
	if err := s.courseRepo.EnrollStudent(courseID, userID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Создаем уведомление для студента
	notificationData := map[string]interface{}{
		"course_id":   courseID,
		"course_name": course.Name,
	}

	s.createNotification(
		userID,
		"course_enrollment",
		"Зачисление на курс",
		fmt.Sprintf("Вы были зачислены на курс '%s'", course.Name),
		notificationData,
	)

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Student enrolled successfully",
	})
}

func (s *Server) handleUnenrollStudent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	courseID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid course ID")
		return
	}

	userID, err := strconv.Atoi(vars["user_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	course, err := s.courseRepo.GetByID(courseID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if course == nil {
		respondWithError(w, http.StatusNotFound, "Course not found")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	canUnenroll := false
	if auth.HasPermission(userClaims, "course:student:write") {
		canUnenroll = true // Админ может отчислять из любого курса
	} else if auth.HasPermission(userClaims, "course:student:write:own") {
		// Преподаватель может отчислять только из своих курсов
		if course.TeacherID == userClaims.UserID {
			canUnenroll = true
		}
	}

	if !canUnenroll {
		respondWithError(w, http.StatusForbidden, "You don't have permission to unenroll students")
		return
	}

	enrolled, err := s.courseRepo.IsStudentEnrolled(courseID, userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !enrolled {
		respondWithError(w, http.StatusBadRequest, "Student is not enrolled in this course")
		return
	}

	if err := s.courseRepo.UnenrollStudent(courseID, userID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	notificationData := map[string]interface{}{
		"course_id":   courseID,
		"course_name": course.Name,
	}

	s.createNotification(
		userID,
		"course_unenrollment",
		"Отчисление с курса",
		fmt.Sprintf("Вы были отчислены с курса '%s'", course.Name),
		notificationData,
	)

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Student unenrolled successfully",
	})
}

func (s *Server) handleGetUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid User ID")
		return
	}

	user, err := s.userRepo.GetByID(id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if user == nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	respondWithJSON(w, http.StatusOK, user)
}

func (s *Server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var user models.User

	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if user.FullName == "" || user.Email == "" {
		respondWithError(w, http.StatusBadRequest, "Full name and email are required")
		return
	}

	if err := s.userRepo.Create(&user); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, user)
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("Error encoding JSON: %v", err)
	}
}

func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}

func (s *Server) handleGetQuestionVersions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	questionID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid question ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Получаем текущую версию вопроса для проверки прав
	currentQuestion, err := s.questionRepo.GetByID(questionID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if currentQuestion == nil {
		respondWithError(w, http.StatusNotFound, "Question not found")
		return
	}

	if !s.canViewQuestion(userClaims, currentQuestion) {
		if !auth.HasPermission(userClaims, "course:test:write") {
			respondWithError(w, http.StatusForbidden, "You don't have permission to view question versions")
			return
		}
	}

	versions, err := s.questionRepo.GetVersions(questionID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, versions)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}

func (s *Server) Start(addr string) error {
	log.Printf("Starting HTTP server on %s", addr)
	return http.ListenAndServe(addr, s)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	valid, err := s.userRepo.CheckPassword(creds.Email, creds.Password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if !valid {
		respondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	user, err := s.userRepo.GetByEmail(creds.Email)
	if err != nil || user == nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	roles, err := s.userRepo.GetUserRoles(user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not get user roles")
		return
	}

	if len(roles) == 0 {
		if err := s.userRepo.AddUserRole(user.ID, "student"); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Could not assign default role")
			return
		}
		roles = []string{"student"}
	}

	token, err := auth.GenerateToken(user.ID, user.Email, roles)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not generate token")
		return
	}

	user.PasswordHash = ""
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  user,
		"roles": roles,
	})
}

func (s *Server) handleStartAttempt(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["test_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	test, err := s.testRepo.GetByID(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if test == nil {
		respondWithError(w, http.StatusNotFound, "Test not found")
		return
	}

	if !test.IsActive {
		respondWithError(w, http.StatusForbidden, "Test is not active")
		return
	}

	attempt, err := s.attemptRepo.StartAttempt(testID, userClaims.UserID)
	if err != nil {
		if attemptErr, ok := err.(*repository.AttemptError); ok {
			respondWithError(w, http.StatusConflict, attemptErr.Message)
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	if test != nil {
		notificationData := map[string]interface{}{
			"test_id":    testID,
			"test_title": test.Title,
			"attempt_id": attempt.ID,
		}

		s.createNotification(
			userClaims.UserID,
			"test_started",
			"Тест начат",
			fmt.Sprintf("Вы начали прохождение теста '%s'", test.Title),
			notificationData,
		)
	}

	respondWithJSON(w, http.StatusCreated, attempt)
}

func (s *Server) handleSubmitAnswer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	attemptID, err := strconv.Atoi(vars["attempt_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid attempt ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	attempt, err := s.attemptRepo.GetAttemptByID(attemptID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if attempt == nil {
		respondWithError(w, http.StatusNotFound, "Attempt not found")
		return
	}

	if attempt.UserID != userClaims.UserID {
		respondWithError(w, http.StatusForbidden, "This attempt doesn't belong to you")
		return
	}

	var answerRequest struct {
		QuestionID      int `json:"question_id"`
		QuestionVersion int `json:"question_version"`
		SelectedOption  int `json:"selected_option"`
	}

	if err := json.NewDecoder(r.Body).Decode(&answerRequest); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if answerRequest.SelectedOption < -1 {
		respondWithError(w, http.StatusBadRequest, "Invalid option selected")
		return
	}

	answer, err := s.attemptRepo.SubmitAnswer(
		attemptID,
		answerRequest.QuestionID,
		answerRequest.QuestionVersion,
		answerRequest.SelectedOption,
	)

	if err != nil {
		if attemptErr, ok := err.(*repository.AttemptError); ok {
			respondWithError(w, http.StatusBadRequest, attemptErr.Message)
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, answer)
}

func (s *Server) handleCompleteAttempt(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	attemptID, err := strconv.Atoi(vars["attempt_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid attempt ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	attempt, err := s.attemptRepo.GetAttemptByID(attemptID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if attempt == nil {
		respondWithError(w, http.StatusNotFound, "Attempt not found")
		return
	}

	if attempt.UserID != userClaims.UserID {
		respondWithError(w, http.StatusForbidden, "This attempt doesn't belong to you")
		return
	}

	completedAttempt, err := s.attemptRepo.CompleteAttempt(attemptID)
	if err != nil {
		if attemptErr, ok := err.(*repository.AttemptError); ok {
			respondWithError(w, http.StatusBadRequest, attemptErr.Message)
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, completedAttempt)
}

func (s *Server) handleGetAttempt(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	attemptID, err := strconv.Atoi(vars["attempt_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid attempt ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	attempt, err := s.attemptRepo.GetAttemptByID(attemptID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if attempt == nil {
		respondWithError(w, http.StatusNotFound, "Attempt not found")
		return
	}

	if attempt.UserID != userClaims.UserID {
		// проверка на препод
		test, err := s.testRepo.GetByID(attempt.TestID)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if test == nil || test.TeacherID != userClaims.UserID {
			respondWithError(w, http.StatusForbidden, "Access denied")
			return
		}
	}

	respondWithJSON(w, http.StatusOK, attempt)
}

func (s *Server) handleCancelAttempt(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	attemptID, err := strconv.Atoi(vars["attempt_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid attempt ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	attempt, err := s.attemptRepo.GetAttemptByID(attemptID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if attempt == nil {
		respondWithError(w, http.StatusNotFound, "Attempt not found")
		return
	}

	if attempt.UserID != userClaims.UserID {
		respondWithError(w, http.StatusForbidden, "Access denied")
		return
	}

	if err := s.attemptRepo.CancelAttempt(attemptID); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

func (s *Server) handleGetAttemptAnswers(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	attemptID, err := strconv.Atoi(vars["attempt_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid attempt ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	attempt, err := s.attemptRepo.GetAttemptByID(attemptID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if attempt == nil {
		respondWithError(w, http.StatusNotFound, "Attempt not found")
		return
	}

	canView := false
	if attempt.UserID == userClaims.UserID {
		canView = true
	} else {
		test, err := s.testRepo.GetByID(attempt.TestID)
		if err == nil && test != nil && test.TeacherID == userClaims.UserID {
			canView = true
		}
	}

	if !canView {
		respondWithError(w, http.StatusForbidden, "Access denied")
		return
	}

	answers, err := s.attemptRepo.GetAttemptAnswers(attemptID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	type AnswerResponse struct {
		QuestionID     int   `json:"question_id"`
		SelectedOption int   `json:"selected_option"`
		IsCorrect      *bool `json:"is_correct,omitempty"`
	}

	response := make([]AnswerResponse, len(answers))
	for i, a := range answers {
		response[i] = AnswerResponse{
			QuestionID:     a.QuestionID,
			SelectedOption: a.SelectedOption,
			IsCorrect:      a.IsCorrect,
		}
	}

	respondWithJSON(w, http.StatusOK, response)
}

func (s *Server) handleActivateTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	test, err := s.testRepo.GetByID(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if test == nil {
		respondWithError(w, http.StatusNotFound, "Test not found")
		return
	}

	canActivate := false
	if auth.HasPermission(userClaims, "test:activate:manage") {
		canActivate = true // Админ может активировать любой тест
	} else if auth.HasPermission(userClaims, "test:activate:manage:own") {
		if test.TeacherID == userClaims.UserID {
			canActivate = true
		}
	}

	if !canActivate {
		respondWithError(w, http.StatusForbidden, "You don't have permission to activate this test")
		return
	}

	if test.IsActive {
		respondWithError(w, http.StatusBadRequest, "Test is already active")
		return
	}

	if test.QuestionsCount == 0 {
		respondWithError(w, http.StatusBadRequest, "Cannot activate test without questions")
		return
	}

	if err := s.testRepo.SetActive(testID, true); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	notificationData := map[string]interface{}{
		"test_id":    testID,
		"test_title": test.Title,
		"course_id":  test.CourseID,
	}

	s.createNotification(
		test.TeacherID,
		"test_activated",
		"Тест активирован",
		fmt.Sprintf("Тест '%s' был активирован", test.Title),
		notificationData,
	)

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Test activated successfully",
		"test_id": strconv.Itoa(testID),
	})
}

func (s *Server) handleGetCourseTests(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	courseID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid course ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	course, err := s.courseRepo.GetByID(courseID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if course == nil {
		respondWithError(w, http.StatusNotFound, "Course not found")
		return
	}

	canView := false

	// Админ может видеть все
	if auth.HasPermission(userClaims, "course:testList:read") {
		canView = true
	} else if auth.HasPermission(userClaims, "course:testList:own") {
		if course.TeacherID == userClaims.UserID {
			canView = true
		}
	} else if auth.HasPermission(userClaims, "course:testList:enrolled") {
		enrolled, err := s.courseRepo.IsStudentEnrolled(courseID, userClaims.UserID)
		if err == nil && enrolled {
			canView = true
		}
	}

	if !canView {
		respondWithError(w, http.StatusForbidden, "You don't have permission to view tests for this course")
		return
	}

	tests, err := s.testRepo.GetByCourseID(courseID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if auth.HasPermission(userClaims, "course:testList:enrolled") {
		var activeTests []models.Test
		for _, test := range tests {
			if test.IsActive && !test.IsDeleted {
				activeTests = append(activeTests, test)
			}
		}
		tests = activeTests
	} else {
		var filteredTests []models.Test
		for _, test := range tests {
			if !test.IsDeleted {
				filteredTests = append(filteredTests, test)
			}
		}
		tests = filteredTests
	}

	respondWithJSON(w, http.StatusOK, tests)
}

func (s *Server) handleDeactivateTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	test, err := s.testRepo.GetByID(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if test == nil {
		respondWithError(w, http.StatusNotFound, "Test not found")
		return
	}

	canDeactivate := false
	if auth.HasPermission(userClaims, "test:activate:manage") {
		canDeactivate = true // Админ может деактивировать любой тест
	} else if auth.HasPermission(userClaims, "test:activate:manage:own") {
		if test.TeacherID == userClaims.UserID {
			canDeactivate = true
		}
	}

	if !canDeactivate {
		respondWithError(w, http.StatusForbidden, "You don't have permission to deactivate this test")
		return
	}

	if !test.IsActive {
		respondWithError(w, http.StatusBadRequest, "Test is already deactivated")
		return
	}

	if err := s.testRepo.SetActive(testID, false); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := s.attemptRepo.CompleteAllAttemptsForTest(testID); err != nil {
		log.Printf("Warning: Failed to complete attempts for deactivated test %d: %v", testID, err)
	}

	notificationData := map[string]interface{}{
		"test_id":    testID,
		"test_title": test.Title,
		"course_id":  test.CourseID,
	}

	s.createNotification(
		test.TeacherID,
		"test_deactivated",
		"Тест деактивирован",
		fmt.Sprintf("Тест '%s' был деактивирован", test.Title),
		notificationData,
	)

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Test deactivated successfully",
		"test_id": strconv.Itoa(testID),
	})
}

func (s *Server) handleGetTestResults(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["test_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	test, err := s.testRepo.GetByID(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if test == nil {
		respondWithError(w, http.StatusNotFound, "Test not found")
		return
	}

	if !s.canModifyCourse(userClaims, &models.Course{ID: test.CourseID, TeacherID: test.TeacherID}, "test:answer:read", "test:answer:read") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to view test results")
		return
	}

	attempts, err := s.attemptRepo.GetTestResults(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	type ResultResponse struct {
		UserID    int      `json:"user_id"`
		Score     *float64 `json:"score,omitempty"`
		StartedAt string   `json:"started_at"`
		Completed string   `json:"completed,omitempty"`
	}

	type TestResultsResponse struct {
		TestID  int              `json:"test_id"`
		Results []ResultResponse `json:"results"`
		Count   int              `json:"count"`
	}

	results := make([]ResultResponse, len(attempts))
	for i, a := range attempts {
		completed := ""
		if a.CompletedAt != nil {
			completed = a.CompletedAt.Format(time.RFC3339)
		}

		results[i] = ResultResponse{
			UserID:    a.UserID,
			Score:     a.Score,
			StartedAt: a.StartedAt.Format(time.RFC3339),
			Completed: completed,
		}
	}

	response := TestResultsResponse{
		TestID:  testID,
		Results: results,
		Count:   len(results),
	}

	respondWithJSON(w, http.StatusOK, response)
}

func (s *Server) handleGetQuestionOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["test_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Получаем информацию о тесте
	test, err := s.testRepo.GetByID(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if test == nil {
		respondWithError(w, http.StatusNotFound, "Test not found")
		return
	}

	// Проверяем права на просмотр теста
	canView := false

	// Админ может видеть все
	if auth.HasPermission(userClaims, "course:test:write") {
		canView = true
	} else if auth.HasPermission(userClaims, "course:test:write:own") {
		// Преподаватель может видеть только свои тесты
		if test.TeacherID == userClaims.UserID {
			canView = true
		}
	}

	if !canView {
		respondWithError(w, http.StatusForbidden, "You don't have permission to view this test")
		return
	}

	// Получаем порядок вопросов
	questionOrder, err := s.testRepo.GetQuestionOrder(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"test_id":      testID,
		"question_ids": questionOrder, // Изменили поле на question_ids
		"count":        len(questionOrder),
	})
}

// handleUpdateQuestionOrder обновляет порядок вопросов в тесте
func (s *Server) handleUpdateQuestionOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["test_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Получаем информацию о тесте
	test, err := s.testRepo.GetByID(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if test == nil {
		respondWithError(w, http.StatusNotFound, "Test not found")
		return
	}

	// Проверяем права на изменение теста
	if !s.canModifyCourse(userClaims, &models.Course{
		ID:        test.CourseID,
		TeacherID: test.TeacherID,
	}, "course:test:write", "course:test:write:own") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to edit this test")
		return
	}

	// Проверяем, что тест не активен
	if test.IsActive {
		respondWithError(w, http.StatusBadRequest, "Cannot modify order of questions in active test")
		return
	}

	var request struct {
		QuestionIDs []int `json:"question_ids"` // Изменили поле на question_ids
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// Проверяем, что массив не пустой
	if len(request.QuestionIDs) == 0 {
		respondWithError(w, http.StatusBadRequest, "Question IDs array cannot be empty")
		return
	}

	// Проверяем уникальность ID вопросов
	questionSet := make(map[int]bool)
	for _, id := range request.QuestionIDs {
		if questionSet[id] {
			respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Duplicate question ID: %d", id))
			return
		}
		questionSet[id] = true
	}

	// Проверяем, что все вопросы существуют и принадлежат преподавателю
	for _, questionID := range request.QuestionIDs {
		question, err := s.questionRepo.GetByID(questionID)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if question == nil {
			respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Question with ID %d not found", questionID))
			return
		}

		// Проверяем права на использование вопроса
		if !s.canModifyQuestion(userClaims, question) {
			respondWithError(w, http.StatusForbidden,
				fmt.Sprintf("You don't have permission to use question with ID %d", questionID))
			return
		}
	}

	// Обновляем порядок
	if err := s.testRepo.UpdateQuestionOrder(testID, request.QuestionIDs); err != nil {
		if strings.Contains(err.Error(), "cannot modify order") {
			respondWithError(w, http.StatusBadRequest, err.Error())
		} else if strings.Contains(err.Error(), "question with id") {
			respondWithError(w, http.StatusBadRequest, err.Error())
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Question order updated successfully",
		"test_id": strconv.Itoa(testID),
	})
}

func (s *Server) handleCreateQuestion(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasAnyPermission(userClaims, "course:test:write:own", "course:test:write") {
		respondWithError(w, http.StatusForbidden, "Insufficient permissions to create questions")
		return
	}

	bodyBytes, _ := io.ReadAll(r.Body)
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	var request struct {
		Text          string   `json:"text"`
		Options       []string `json:"options"`
		CorrectOption int      `json:"correct_option"`
		Points        int      `json:"points"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	if request.Text == "" {
		respondWithError(w, http.StatusBadRequest, "Text is required")
		return
	}

	if len(request.Options) != 2 {
		respondWithError(w, http.StatusBadRequest, "Exactly 2 options are required")
		return
	}

	if request.Options[0] == "" || request.Options[1] == "" {
		respondWithError(w, http.StatusBadRequest, "These 2 options must be non-empty")
		return
	}

	if request.CorrectOption != 0 && request.CorrectOption != 1 {
		respondWithError(w, http.StatusBadRequest, "correct_option must be 0 or 1")
		return
	}

	if request.Points <= 0 {
		request.Points = 1
	}

	title := request.Text
	if len(title) > 50 {
		title = title[:50]
	}

	question := &models.Question{
		Title:         title,
		Text:          request.Text,
		Options:       request.Options,
		CorrectOption: request.CorrectOption,
		Points:        request.Points,
		AuthorID:      userClaims.UserID,
	}

	if err := s.questionRepo.Create(question); err != nil {
		log.Printf("Error creating question: %v", err)
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, question)
}

func (s *Server) handleGetQuestion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	questionID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid question ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	question, err := s.questionRepo.GetByID(questionID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if question == nil {
		respondWithError(w, http.StatusNotFound, "Question not found")
		return
	}

	if !s.canViewQuestion(userClaims, question) {
		response := map[string]interface{}{
			"id":      question.ID,
			"title":   question.Title,
			"text":    question.Text,
			"options": question.Options,
			"points":  question.Points,
		}
		respondWithJSON(w, http.StatusOK, response)
		return
	}

	respondWithJSON(w, http.StatusOK, question)
}

func (s *Server) handleCreateTest(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	hasPermission := auth.HasAnyPermission(userClaims, "course:test:write:own", "course:test:write")
	if !hasPermission {
		respondWithError(w, http.StatusForbidden, "Insufficient permissions to create tests")
		return
	}

	var test models.Test
	if err := json.NewDecoder(r.Body).Decode(&test); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if test.Title == "" || test.CourseID == 0 {
		respondWithError(w, http.StatusBadRequest, "Test name and course_id are required")
		return
	}

	course, err := s.courseRepo.GetByID(test.CourseID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if course == nil {
		respondWithError(w, http.StatusNotFound, "Course not found")
		return
	}

	hasGeneralPermission := auth.HasPermission(userClaims, "course:test:write")
	hasOwnPermission := auth.HasPermission(userClaims, "course:test:write:own")

	if hasOwnPermission && !hasGeneralPermission {
		if course.TeacherID != userClaims.UserID {
			respondWithError(w, http.StatusForbidden, "You can only create tests for your own courses")
			return
		}
	}

	test.TeacherID = userClaims.UserID
	test.IsActive = false

	if err := s.testRepo.Create(&test); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, test)
}

func (s *Server) handleGetTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	test, err := s.testRepo.GetByID(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if test == nil {
		respondWithError(w, http.StatusNotFound, "Test not found")
		return
	}

	if test.TeacherID != userClaims.UserID && !auth.HasPermission(userClaims, "course:test:write") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to view this test")
		return
	}

	respondWithJSON(w, http.StatusOK, test)
}

func (s *Server) handleGetTests(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasAnyPermission(userClaims, "course:testList:own", "course:testList:read", "course:testList:enrolled") {
		respondWithError(w, http.StatusForbidden, "Insufficient permissions to view tests")
		return
	}

	var tests []models.Test
	var err error

	if auth.HasPermission(userClaims, "course:testList:read") {
		tests, err = s.testRepo.GetByTeacherID(userClaims.UserID)
	} else if auth.HasPermission(userClaims, "course:testList:own") {
		tests, err = s.testRepo.GetByTeacherID(userClaims.UserID)
	} else if auth.HasPermission(userClaims, "course:testList:enrolled") {
		tests, err = s.testRepo.GetByTeacherID(userClaims.UserID)
	}

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, tests)
}

func (s *Server) handleAddQuestionToTest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	testID, err := strconv.Atoi(vars["test_id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid test ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	test, err := s.testRepo.GetByID(testID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if test == nil {
		respondWithError(w, http.StatusNotFound, "Test not found")
		return
	}

	if !s.canModifyCourse(userClaims, &models.Course{ID: test.CourseID, TeacherID: test.TeacherID}, "course:test:write", "course:test:write:own") {
		respondWithError(w, http.StatusForbidden, "You don't have permission to edit this test")
		return
	}

	if test.IsActive {
		respondWithError(w, http.StatusBadRequest, "Cannot modify question of an active test")
		return
	}

	var request struct {
		QuestionID int `json:"question_id"`
		OrderIndex int `json:"order_index,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	question, err := s.questionRepo.GetByID(request.QuestionID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if question == nil {
		respondWithError(w, http.StatusNotFound, "Question not found")
		return
	}

	// Проверяем права на использование вопроса
	if !s.canModifyQuestion(userClaims, question) {
		respondWithError(w, http.StatusForbidden, "You don't have permission to use this question")
		return
	}

	if err := s.testRepo.AddQuestion(testID, request.QuestionID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Question added to test successfully",
	})
}

func (s *Server) handleUpdateQuestion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	questionID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid question ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	existingQuestion, err := s.questionRepo.GetByID(questionID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if existingQuestion == nil {
		respondWithError(w, http.StatusNotFound, "Question not found")
		return
	}

	if !s.canModifyQuestion(userClaims, existingQuestion) {
		respondWithError(w, http.StatusForbidden, "You don't have permission to update this question")
		return
	}

	var updates struct {
		Title         string   `json:"title"`
		Text          string   `json:"text"`
		Options       []string `json:"options"`
		CorrectOption int      `json:"correct_option"`
		Points        int      `json:"points"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if updates.Title != "" {
		existingQuestion.Title = updates.Title
	}
	if updates.Text != "" {
		existingQuestion.Text = updates.Text
	}

	if len(updates.Options) > 0 {
		if len(updates.Options) != 2 {
			respondWithError(w, http.StatusBadRequest, "Exactly 2 options are required")
			return
		}
		if updates.Options[0] == "" || updates.Options[1] == "" {
			respondWithError(w, http.StatusBadRequest, "Both options must be non-empty")
			return
		}
		existingQuestion.Options = updates.Options
	}

	if updates.CorrectOption == 0 || updates.CorrectOption == 1 {
		existingQuestion.CorrectOption = updates.CorrectOption
	} else if updates.CorrectOption != 0 && updates.CorrectOption != 1 && updates.CorrectOption != -1 {
		respondWithError(w, http.StatusBadRequest, "correct_option must be 0 or 1")
		return
	}

	if updates.Points > 0 {
		existingQuestion.Points = updates.Points
	}

	if err := s.questionRepo.Update(existingQuestion); err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Question not found")
		} else if qErr, ok := err.(*repository.QuestionError); ok {
			respondWithError(w, http.StatusBadRequest, qErr.Message)
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, existingQuestion)
}

func (s *Server) handleDeleteQuestion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	questionID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid question ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	existingQuestion, err := s.questionRepo.GetByID(questionID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if existingQuestion == nil {
		respondWithError(w, http.StatusNotFound, "Question not found")
		return
	}

	if !s.canModifyQuestion(userClaims, existingQuestion) {
		respondWithError(w, http.StatusForbidden, "You don't have permission to delete this question")
		return
	}

	if err := s.questionRepo.Delete(questionID); err != nil {
		if qErr, ok := err.(*repository.QuestionError); ok {
			respondWithError(w, http.StatusBadRequest, qErr.Message)
		} else if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Question not found")
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (s *Server) handleGetMyQuestions(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Проверяем permissions вместо ролей
	if !auth.HasAnyPermission(userClaims, "course:test:write:own", "course:test:write") {
		respondWithError(w, http.StatusForbidden, "Insufficient permissions to view questions")
		return
	}

	questions, err := s.questionRepo.GetByTeacher(userClaims.UserID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, questions)
}

func (s *Server) handleCreateCourse(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasAnyPermission(userClaims, "course:info:write", "course:info:write:own") {
		respondWithError(w, http.StatusForbidden, "Insufficient permissions to create courses")
		return
	}

	var course models.Course
	if err := json.NewDecoder(r.Body).Decode(&course); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	course.TeacherID = userClaims.UserID

	if err := s.courseRepo.Create(&course); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, course)
}

func (s *Server) handleGetNotifications(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	notifications, err := s.notificationRepo.GetByUserID(userClaims.UserID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, notifications)
}

func (s *Server) handleMarkNotificationAsRead(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	notificationID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid notification ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := s.notificationRepo.MarkAsRead(notificationID, userClaims.UserID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Notification marked as read"})
}

func (s *Server) handleMarkAllNotificationsAsRead(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := s.notificationRepo.MarkAllAsRead(userClaims.UserID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "All notifications marked as read"})
}

func (s *Server) handleDeleteNotification(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	notificationID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid notification ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := s.notificationRepo.Delete(notificationID, userClaims.UserID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Notification deleted"})
}

func (s *Server) handleDeleteAllNotifications(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if err := s.notificationRepo.DeleteAll(userClaims.UserID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "All notifications deleted"})
}

func (s *Server) handleGetUnreadCount(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	count, err := s.notificationRepo.GetUnreadCount(userClaims.UserID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]int{"unread_count": count})
}

func (s *Server) createNotification(userID int, notificationType, title, message string, data map[string]interface{}) error {
	var dataJSON string
	if data != nil {
		jsonData, err := json.Marshal(data)
		if err != nil {
			return err
		}
		dataJSON = string(jsonData)
	} else {
		dataJSON = "{}"
	}

	notification := &models.Notification{
		UserID:    userID,
		Type:      notificationType,
		Title:     title,
		Message:   message,
		Data:      dataJSON,
		IsRead:    false,
		CreatedAt: time.Now(),
	}

	return s.notificationRepo.Create(notification)
}

func (s *Server) createNotificationForUsers(userIDs []int, notificationType, title, message string, data map[string]interface{}) error {
	for _, userID := range userIDs {
		if err := s.createNotification(userID, notificationType, title, message, data); err != nil {
			log.Printf("Failed to create notification for user %d: %v", userID, err)
		}
	}
	return nil
}

func (s *Server) handleCreateTestNotification(w http.ResponseWriter, r *http.Request) {
	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var request struct {
		Type    string `json:"type"`
		Title   string `json:"title"`
		Message string `json:"message"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	notification := &models.Notification{
		UserID:    userClaims.UserID,
		Type:      request.Type,
		Title:     request.Title,
		Message:   request.Message,
		Data:      "{}",
		IsRead:    false,
		CreatedAt: time.Now(),
	}

	if err := s.notificationRepo.Create(notification); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, notification)
}

func (s *Server) handleGetUserRoles(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "user:role:manage") {
		if userID != userClaims.UserID {
			respondWithError(w, http.StatusForbidden, "Insufficient permissions to view user roles")
			return
		}
	}
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	roles, err := s.userRepo.GetUserRoles(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"user_id": userID,
		"roles":   roles,
	})
}

func (s *Server) handleUpdateUserRoles(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "user:role:manage") {
		respondWithError(w, http.StatusForbidden, "Insufficient permissions to update user roles")
		return
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	var request struct {
		Roles []string `json:"roles"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if len(request.Roles) == 0 {
		respondWithError(w, http.StatusBadRequest, "User must have at least one role")
		return
	}

	validRoles := map[string]bool{
		"student": true,
		"teacher": true,
		"admin":   true,
	}

	for _, role := range request.Roles {
		if !validRoles[role] {
			respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Invalid role: %s. Allowed roles: student, teacher, admin", role))
			return
		}
	}

	if userID == userClaims.UserID {
		currentRoles, err := s.userRepo.GetUserRoles(userID)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		wasAdmin := false
		for _, role := range currentRoles {
			if role == "admin" {
				wasAdmin = true
				break
			}
		}

		willBeAdmin := false
		for _, role := range request.Roles {
			if role == "admin" {
				willBeAdmin = true
				break
			}
		}

		if wasAdmin && !willBeAdmin {
			adminCount, err := s.userRepo.CountAdmins()
			if err != nil {
				respondWithError(w, http.StatusInternalServerError, err.Error())
				return
			}

			if adminCount <= 1 {
				respondWithError(w, http.StatusBadRequest, "Cannot remove admin role from the last admin in the system")
				return
			}
		}
	}

	if err := s.userRepo.UpdateUserRoles(userID, request.Roles); err != nil {
		if strings.Contains(err.Error(), "invalid role") {
			respondWithError(w, http.StatusBadRequest, err.Error())
		} else {
			respondWithError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "User roles updated successfully",
		"user_id": userID,
		"roles":   request.Roles,
	})
}

func (s *Server) handleBlockUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "user:block:manage") {
		respondWithError(w, http.StatusForbidden, "Insufficient permissions to block users")
		return
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	if userID == userClaims.UserID {
		respondWithError(w, http.StatusBadRequest, "You cannot block yourself")
		return
	}

	if err := s.userRepo.BlockUser(userID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "User blocked successfully",
		"user_id": strconv.Itoa(userID),
	})
}

func (s *Server) handleUnblockUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "user:block:manage") {
		respondWithError(w, http.StatusForbidden, "Insufficient permissions to unblock users")
		return
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	// Разблокируем пользователя
	if err := s.userRepo.UnblockUser(userID); err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "User unblocked successfully",
		"user_id": strconv.Itoa(userID),
	})
}

func (s *Server) handleGetBlockStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := strconv.Atoi(vars["id"])
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	userClaims, ok := r.Context().Value("user").(*auth.Claims)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if !auth.HasPermission(userClaims, "user:block:read") &&
		!auth.HasPermission(userClaims, "user:block:manage") {
		if userID != userClaims.UserID {
			respondWithError(w, http.StatusForbidden, "Insufficient permissions to view block status")
			return
		}
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	isBlocked, err := s.userRepo.GetBlockStatus(userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"user_id":    userID,
		"is_blocked": isBlocked,
	})
}

func (s *Server) BlockMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Пропускаем публичные эндпоинты
		if r.URL.Path == "/health" ||
			r.URL.Path == "/api/login" ||
			r.URL.Path == "/api/register" {
			next.ServeHTTP(w, r)
			return
		}

		// Получаем claims из контекста
		claims, ok := r.Context().Value("user").(*auth.Claims)
		if !ok {
			// Если нет claims, значит пользователь не аутентифицирован
			// Это нормально для публичных эндпоинтов
			next.ServeHTTP(w, r)
			return
		}

		// Проверяем, не заблокирован ли пользователь
		user, err := s.userRepo.GetByID(claims.UserID)
		if err != nil {
			// Если ошибка БД, пропускаем (лучше логировать)
			next.ServeHTTP(w, r)
			return
		}

		if user != nil && user.IsBlocked {
			// Пользователь заблокирован - возвращаем 418
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTeapot) // 418
			json.NewEncoder(w).Encode(map[string]string{
				"error": "User is blocked. Access denied.",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

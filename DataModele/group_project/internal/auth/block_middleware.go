package auth

import (
	"encoding/json"
	"net/http"
	"sql_module/internal/repository"
)

type BlockMiddleware struct {
	userRepo *repository.UserRepository
}

func NewBlockMiddleware(userRepo *repository.UserRepository) *BlockMiddleware {
	return &BlockMiddleware{
		userRepo: userRepo,
	}
}

func (m *BlockMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPublicEndpoint(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		claims, ok := r.Context().Value("user").(*Claims)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}

		user, err := m.userRepo.GetByID(claims.UserID)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}

		if user != nil && user.IsBlocked {
			respondBlocked(w)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isPublicEndpoint(path string) bool {
	publicEndpoints := []string{
		"/health",
		"/api/login",
		"/api/register",
	}

	for _, endpoint := range publicEndpoints {
		if path == endpoint {
			return true
		}
	}
	return false
}

func respondBlocked(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTeapot) // 418
	json.NewEncoder(w).Encode(map[string]string{
		"error": "User is blocked. Access denied.",
	})
}

func (m *BlockMiddleware) BlockCheckHandler(next http.Handler) http.Handler {
	return m.Middleware(next)
}

func (m *BlockMiddleware) IsUserBlocked(userID int) (bool, error) {
	user, err := m.userRepo.GetByID(userID)
	if err != nil {
		return false, err
	}
	if user == nil {
		return false, nil
	}
	return user.IsBlocked, nil
}

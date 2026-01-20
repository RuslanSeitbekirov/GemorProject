package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID      int      `json:"user_id"`
	Email       string   `json:"email"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

var jwtSecret = []byte("your-secret-key-change-in-production") // вынести в кфг

func GenerateToken(userID int, email string, roles []string) (string, error) {
	claims := Claims{
		UserID:      userID,
		Email:       email,
		Roles:       roles,
		Permissions: GetPermissionByRoles(roles), // ← вычисляем внутри
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "sql_module",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func VerifyToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

func JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" || r.URL.Path == "/api/login" || r.URL.Path == "/api/register" {
			next.ServeHTTP(w, r)
			return
		}
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error" : "Authorization header required"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `"error" : "Authorization header format must be Bearer {token}"}`, http.StatusUnauthorized)
			return
		}

		token := parts[1]
		claims, err := VerifyToken(token)
		if err != nil {
			http.Error(w, `"error" : "Invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "user", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetPermissionByRoles(roles []string) []string {
	permissions := []string{}

	for _, role := range roles {
		switch role {
		case "admin":
			permissions = append(permissions,
				"user:list:read",
				"user:list:write",
				"user:data:read",
				"user:data:write",
				"user:block:manage",
				"user:role:manage",
				"course:info:write",
				"course:del",
				"course:test:write",
				"course:test:add",
				"course:testList:read",
				"test:answer:read",
				"test:activate:manage",
				"notification:read",
				"course:student:write",
				"course:student:read",
				"notification:manage",
			)
		case "teacher":
			permissions = append(permissions,
				"user:list:read",
				"user:data:read",
				"course:info:write:own",
				"course:testList:own",
				"course:test:read:own",
				"course:test:write:own",
				"course:test:add:own",
				"test:answer:read",
				"test:activate:manage:own",
				"notification:read",
				"course:student:write:own",
				"course:student:read:own",
			)
		case "student":
			permissions = append(permissions,
				"user:data:read:self",
				"course:testList:enrolled",
				"course:test:read:enrolled",
				"attempt:create",
				"attempt:update:self",
				"attempt:complete:self",
				"attempt:read:self",
				"answer:read:self",
				"answer:update:self",
				"answer:del:self",
				"course:user:add:self", // добавление только себя на курс
				"notification:read",
				"notification:manage:self",
			)
		}
	}
	return permissions
}

func CheckPermission(requiredPermission string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value("user").(*Claims)
			if !ok {
				http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
				return
			}

			hasPermission := false
			for _, perm := range claims.Permissions {
				if perm == requiredPermission {
					hasPermission = true
					break
				}
			}

			if !hasPermission {
				http.Error(w, `{"error": "Forbidden: insufficient permissions"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func HasPermission(claims *Claims, requiredPermission string) bool {
	if claims == nil {
		return false
	}

	for _, perm := range claims.Permissions {
		if perm == requiredPermission {
			return true
		}
	}
	return false
}

func HasAnyPermission(claims *Claims, requiredPermissions ...string) bool {
	if claims == nil {
		return false
	}

	for _, requiredPerm := range requiredPermissions {
		for _, userPerm := range claims.Permissions {
			if userPerm == requiredPerm {
				return true
			}
		}
	}
	return false
}

func CheckOwnershipMiddleware(ownerIDExtractor func(r *http.Request) (int, error)) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value("user").(*Claims)
			if !ok {
				http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ownerID, err := ownerIDExtractor(r)
			if err != nil {
				http.Error(w, `{"error": "Failed to extract resource owner"}`, http.StatusBadRequest)
				return
			}

			for _, role := range claims.Roles {
				if role == "admin" {
					next.ServeHTTP(w, r)
					return
				}
			}

			if claims.UserID != ownerID {
				http.Error(w, `{"error": "Forbidden: resource does not belong to you"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

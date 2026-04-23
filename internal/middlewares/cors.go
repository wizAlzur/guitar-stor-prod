package middlewares

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func CORS(allowedOrigin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" || origin != allowedOrigin {
			c.Next()
			return
		}

		headers := c.Writer.Header()
		headers.Set("Vary", "Origin")
		headers.Set("Access-Control-Allow-Origin", origin)
		headers.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		headers.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key")
		headers.Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

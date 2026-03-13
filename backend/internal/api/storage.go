package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"lxcmaster/internal/incus"
)

type StorageResponse struct {
	Name   string `json:"name"`
	Driver string `json:"driver"`
	Used   int64  `json:"used"`
	Total  int64  `json:"total"`
}

func ListStorage(c *gin.Context) {
	pools, err := incus.DefaultClient.ListStoragePools()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]StorageResponse, 0, len(pools))
	for _, pool := range pools {
		result = append(result, StorageResponse{
			Name:   pool.Name,
			Driver: pool.Driver,
		})
	}

	c.JSON(http.StatusOK, result)
}

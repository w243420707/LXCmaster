package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"lxcmaster/internal/incus"
)

type NetworkResponse struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Managed bool   `json:"managed"`
}

func ListNetworks(c *gin.Context) {
	networks, err := incus.DefaultClient.ListNetworks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := make([]NetworkResponse, 0, len(networks))
	for _, net := range networks {
		result = append(result, NetworkResponse{
			Name:    net.Name,
			Type:    net.Type,
			Managed: net.Managed,
		})
	}

	c.JSON(http.StatusOK, result)
}

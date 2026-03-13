package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"lxcmaster/internal/incus"
)

type ImageResponse struct {
	Fingerprint string `json:"fingerprint"`
	Alias       string `json:"alias"`
	OS          string `json:"os"`
	Arch        string `json:"architecture"`
	Size        int64  `json:"size"`
}

func ListImages(c *gin.Context) {
	images, err := incus.DefaultClient.ListImages()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	aliases, _ := incus.DefaultClient.GetImageAliases()
	aliasMap := make(map[string]string)
	for _, a := range aliases {
		aliasMap[a.Target] = a.Name
	}

	result := make([]ImageResponse, 0, len(images))
	for _, img := range images {
		alias := ""
		if a, ok := aliasMap[img.Fingerprint]; ok {
			alias = a
		} else if len(img.Aliases) > 0 {
			alias = img.Aliases[0].Name
		}

		result = append(result, ImageResponse{
			Fingerprint: img.Fingerprint,
			Alias:       alias,
			OS:          img.Properties["os"],
			Arch:        img.Architecture,
			Size:        img.Size,
		})
	}

	c.JSON(http.StatusOK, result)
}

package api

import (
	"lxcmaster/internal/config"
	"github.com/gin-gonic/gin"
)

func SetupRouter(cfg *config.Config) *gin.Engine {
	router := gin.Default()
	
	router.Static("/assets", "./frontend/assets")
	router.NoRoute(func(c *gin.Context) {
		c.File("./frontend/index.html")
	})
	
	api := router.Group("/api")
	{
		api.GET("/containers", ListContainers)
		api.POST("/containers", CreateContainer)
		api.GET("/containers/:name", GetContainer)
		api.PUT("/containers/:name", UpdateContainer)
		api.DELETE("/containers/:name", DeleteContainer)
		api.POST("/containers/:name/start", StartContainer)
		api.POST("/containers/:name/stop", StopContainer)
		api.POST("/containers/:name/restart", RestartContainer)
		api.GET("/containers/:name/exec", ExecContainer)
		api.GET("/containers/:name/ports", ListPortMappings)
		api.POST("/containers/:name/ports", AddPortMapping)
		api.DELETE("/containers/:name/ports/:port", DeletePortMapping)
		
		api.GET("/images", ListImages)
		api.GET("/networks", ListNetworks)
		api.GET("/storage", ListStorage)
	}
	
	return router
}

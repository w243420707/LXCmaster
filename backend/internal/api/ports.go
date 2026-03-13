package api

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/lxc/incus/shared/api"
	"lxcmaster/internal/incus"
)

type PortMapping struct {
	HostPort      int    `json:"host_port"`
	ContainerPort int    `json:"container_port"`
	Protocol      string `json:"protocol"`
	ListenAddress string `json:"listen_address"`
}

type PortMappingsResponse struct {
	Name     string        `json:"name"`
	Mappings []PortMapping `json:"mappings"`
}

func ListPortMappings(c *gin.Context) {
	name := c.Param("name")

	inst, _, err := incus.DefaultClient.GetInstance(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "container not found"})
		return
	}

	mappings := []PortMapping{}
	for devName, dev := range inst.Devices {
		if dev["type"] == "proxy" {
			hostPort, _ := strconv.Atoi(extractPort(dev["listen"]))
			containerPort, _ := strconv.Atoi(extractPort(dev["connect"]))
			
			mappings = append(mappings, PortMapping{
				HostPort:      hostPort,
				ContainerPort: containerPort,
				Protocol:      extractProtocol(dev["listen"]),
				ListenAddress: extractAddress(dev["listen"]),
			})
			_ = devName
		}
	}

	c.JSON(http.StatusOK, PortMappingsResponse{
		Name:     name,
		Mappings: mappings,
	})
}

type AddPortMappingRequest struct {
	HostPort      int    `json:"host_port" binding:"required"`
	ContainerPort int    `json:"container_port" binding:"required"`
	Protocol      string `json:"protocol"`
	ListenAddress string `json:"listen_address"`
}

func AddPortMapping(c *gin.Context) {
	name := c.Param("name")

	var req AddPortMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	protocol := req.Protocol
	if protocol == "" {
		protocol = "tcp"
	}

	listenAddr := req.ListenAddress
	if listenAddr == "" {
		listenAddr = "0.0.0.0"
	}

	inst, etag, err := incus.DefaultClient.GetInstance(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "container not found"})
		return
	}

	devName := fmt.Sprintf("port%d", req.HostPort)
	
	if inst.Devices == nil {
		inst.Devices = make(map[string]map[string]string)
	}

	inst.Devices[devName] = map[string]string{
		"type":    "proxy",
		"listen":  fmt.Sprintf("%s:%s:%d", protocol, listenAddr, req.HostPort),
		"connect": fmt.Sprintf("%s:127.0.0.1:%d", protocol, req.ContainerPort),
	}

	updateReq := api.InstancePut{
		Config:   inst.Config,
		Devices:  inst.Devices,
		Profiles: inst.Profiles,
	}

	op, err := incus.DefaultClient.UpdateInstance(name, updateReq, etag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"operation": getOperationID(op),
		"message":   "port mapping added",
	})
}

func DeletePortMapping(c *gin.Context) {
	name := c.Param("name")
	hostPort := c.Param("port")

	inst, etag, err := incus.DefaultClient.GetInstance(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "container not found"})
		return
	}

	devName := fmt.Sprintf("port%s", hostPort)
	
	if _, exists := inst.Devices[devName]; !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "port mapping not found"})
		return
	}

	delete(inst.Devices, devName)

	updateReq := api.InstancePut{
		Config:   inst.Config,
		Devices:  inst.Devices,
		Profiles: inst.Profiles,
	}

	op, err := incus.DefaultClient.UpdateInstance(name, updateReq, etag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"operation": getOperationID(op),
		"message":   "port mapping deleted",
	})
}

func extractPort(addr string) string {
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[i+1:]
		}
	}
	return ""
}

func extractProtocol(addr string) string {
	for i := 0; i < len(addr); i++ {
		if addr[i] == ':' {
			return addr[:i]
		}
	}
	return "tcp"
}

func extractAddress(addr string) string {
	parts := []string{}
	start := 0
	colonCount := 0
	
	for i := 0; i < len(addr); i++ {
		if addr[i] == ':' {
			colonCount++
			if colonCount == 2 {
				parts = append(parts, addr[start:i])
				start = i + 1
			}
		}
	}
	
	if len(parts) > 0 {
		return parts[0]
	}
	return "0.0.0.0"
}

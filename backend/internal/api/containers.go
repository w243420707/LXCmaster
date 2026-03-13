package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	incusapi "github.com/lxc/incus/shared/api"
	"lxcmaster/internal/incus"
)

type ContainerResponse struct {
	Name        string            `json:"name"`
	Status      string            `json:"status"`
	IPAddress   string            `json:"ip_address"`
	CPU         int64             `json:"cpu"`
	Memory      int64             `json:"memory"`
	DiskMax     int64             `json:"disk_max"`
	SwapEnabled bool              `json:"swap_enabled"`
	SSHPort     int               `json:"ssh_port"`
	RootPassword string           `json:"root_password"`
	Config      map[string]string `json:"config"`
}

func ListContainers(c *gin.Context) {
	instances, err := incus.DefaultClient.ListInstances()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	containers := make([]ContainerResponse, 0, len(instances))
	for _, inst := range instances {
		resp := ContainerResponse{
			Name:   inst.Name,
			Status: inst.Status,
			Config: inst.Config,
		}

		if cpu, ok := inst.Config["limits.cpu"]; ok {
			resp.CPU = parseInt64(cpu)
		}
		if mem, ok := inst.Config["limits.memory"]; ok {
			resp.Memory = parseMemory(mem)
		}
		if disk, ok := inst.Config["limits.disk"]; ok {
			resp.DiskMax = parseDisk(disk)
		}
		if swap, ok := inst.Config["limits.memory.swap"]; ok {
			resp.SwapEnabled = swap == "true"
		}
		if sshPort, ok := inst.Config["user.ssh_port"]; ok {
			resp.SSHPort = int(parseInt64(sshPort))
		}
		if pwd, ok := inst.Config["user.root_password"]; ok {
			resp.RootPassword = pwd
		}

		if ssh, ok := inst.Devices["ssh"]; ok {
			if listen, ok := ssh["listen"]; ok {
				port := parsePortFromListen(listen)
				if port > 0 {
					resp.SSHPort = port
				}
			}
		}

		state, _, err := incus.DefaultClient.GetInstanceState(inst.Name)
		if err == nil && len(state.Network) > 0 {
			for _, net := range state.Network {
				if len(net.Addresses) > 0 {
					resp.IPAddress = net.Addresses[0].Address
					break
				}
			}
		}

		containers = append(containers, resp)
	}

	c.JSON(http.StatusOK, containers)
}

func GetContainer(c *gin.Context) {
	name := c.Param("name")

	inst, etag, err := incus.DefaultClient.GetInstance(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "container not found"})
		return
	}

	state, _, _ := incus.DefaultClient.GetInstanceState(name)

	resp := ContainerResponse{
		Name:   inst.Name,
		Status: inst.Status,
		Config: inst.Config,
	}

	if cpu, ok := inst.Config["limits.cpu"]; ok {
		resp.CPU = parseInt64(cpu)
	}
	if mem, ok := inst.Config["limits.memory"]; ok {
		resp.Memory = parseMemory(mem)
	}
	if disk, ok := inst.Config["limits.disk"]; ok {
		resp.DiskMax = parseDisk(disk)
	}
	if swap, ok := inst.Config["limits.memory.swap"]; ok {
		resp.SwapEnabled = swap == "true"
	}

	if state != nil && len(state.Network) > 0 {
		for _, net := range state.Network {
			if len(net.Addresses) > 0 {
				resp.IPAddress = net.Addresses[0].Address
				break
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"container": resp,
		"etag":      etag,
		"state":     state,
	})
}

type PortMapping struct {
	HostPort      string   `json:"hostPort"`
	ContainerPort string   `json:"containerPort"`
	Protocols     []string `json:"protocols"`
	IPVersions    []string `json:"ipVersions"`
}

type CreateContainerRequest struct {
	Name         string        `json:"name" binding:"required"`
	Image        string        `json:"image" binding:"required"`
	CPU          int64         `json:"cpu"`
	Memory       int64         `json:"memory"`
	DiskMax      int64         `json:"diskMax"`
	EnableSwap   bool          `json:"enableSwap"`
	EnableSSH    bool          `json:"enableSSH"`
	SSHPort      int           `json:"sshPort"`
	RootPassword string        `json:"rootPassword"`
	PortMappings []PortMapping `json:"portMappings"`
	Config       map[string]string `json:"config"`
	Profiles     []string      `json:"profiles"`
	Network      string        `json:"network"`
	Storage      string        `json:"storage"`
}

func CreateContainer(c *gin.Context) {
	var req CreateContainerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config := make(map[string]string)
	if req.Config != nil {
		config = req.Config
	}

	if req.CPU > 0 {
		config["limits.cpu"] = strconv.FormatInt(req.CPU, 10)
	}
	if req.Memory > 0 {
		config["limits.memory"] = formatMemory(req.Memory)
	}
	if req.DiskMax > 0 {
		config["limits.disk"] = formatDisk(req.DiskMax)
	}
	if req.EnableSwap {
		config["limits.memory.swap"] = "true"
		config["limits.memory.swap.priority"] = "1"
	}
	if req.EnableSSH && req.SSHPort > 0 {
		config["user.ssh_port"] = strconv.Itoa(req.SSHPort)
		if req.RootPassword != "" {
			config["user.root_password"] = req.RootPassword
		}
	}

	profiles := req.Profiles
	if len(profiles) == 0 {
		profiles = []string{"default"}
	}

	devices := make(map[string]map[string]string)

	devices["tun"] = map[string]string{
		"type":   "unix-char",
		"path":   "/dev/net/tun",
		"source": "/dev/net/tun",
	}

	deviceIndex := 1

	if req.Network != "" {
		devices["eth0"] = map[string]string{
			"type":    "nic",
			"network": req.Network,
			"name":    "eth0",
		}
	}

	if req.Storage != "" {
		devices["root"] = map[string]string{
			"type": "disk",
			"path": "/",
			"pool": req.Storage,
		}
	}

	for i, port := range req.PortMappings {
		for _, ipVersion := range port.IPVersions {
			for _, protocol := range port.Protocols {
				deviceName := fmt.Sprintf("port%d", deviceIndex)
				listenAddr := "0.0.0.0"
				if ipVersion == "v6" {
					listenAddr = "[::]"
				}
				devices[deviceName] = map[string]string{
					"type":    "proxy",
					"listen":  fmt.Sprintf("%s:%s:%s", protocol, listenAddr, port.HostPort),
					"connect": fmt.Sprintf("%s:127.0.0.1:%s", protocol, port.ContainerPort),
				}
				deviceIndex++
			}
		}
	}

	if req.EnableSSH && req.SSHPort > 0 {
		devices["ssh"] = map[string]string{
			"type":    "proxy",
			"listen":  fmt.Sprintf("tcp:0.0.0.0:%d", req.SSHPort),
			"connect": "tcp:127.0.0.1:22",
		}
	}

	imageAlias := req.Image
	if imageAlias == "" {
		imageAlias = "alpine/3.18"
	}

	createReq := incusapi.InstancesPost{
		Name: req.Name,
		Source: incusapi.InstanceSource{
			Type:  "image",
			Alias: imageAlias,
		},
		Type:     incusapi.InstanceTypeContainer,
		Profiles: profiles,
		Config:   config,
		Devices:  devices,
	}

	op, err := incus.DefaultClient.CreateInstance(createReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.EnableSSH {
		go func() {
			_ = op.Wait()
			
			startOp, err := incus.DefaultClient.StartInstance(req.Name)
			if err == nil {
				_ = startOp.Wait()
			}
			
			setupSSH(req.Name, req.RootPassword)
		}()
	}

	c.JSON(http.StatusAccepted, gin.H{
		"operation": op.ID(),
		"message":   "container creation initiated",
		"ssh_port":  req.SSHPort,
	})
}

func setupSSH(name, password string) {
	if password == "" {
		password = generateRandomPassword()
	}

	commands := []string{
		"command -v apk && apk add --no-cache openssh || (apt-get update && apt-get install -y openssh-server)",
		"mkdir -p /root/.ssh /run/sshd",
		fmt.Sprintf("echo 'root:%s' | chpasswd", password),
		"sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config 2>/dev/null || echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config",
		"sed -i 's/PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config 2>/dev/null",
		"command -v rc-service && rc-service sshd start || (systemctl start ssh 2>/dev/null || /usr/sbin/sshd)",
	}

	for _, cmd := range commands {
		execReq := incusapi.InstanceExecPost{
			Command:     []string{"sh", "-c", cmd},
			WaitForWS:   false,
			Interactive: false,
		}
		_, _ = incus.DefaultClient.ExecInstance(name, execReq)
	}

	inst, etag, err := incus.DefaultClient.GetInstance(name)
	if err == nil {
		inst.Config["user.root_password"] = password
		updateReq := incusapi.InstancePut{
			Config:  inst.Config,
			Devices: inst.Devices,
		}
		_, _ = incus.DefaultClient.UpdateInstance(name, updateReq, etag)
	}
}

func generateRandomPassword() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 12)
	for i := range b {
		b[i] = charset[i%len(charset)]
	}
	return string(b)
}

func parsePortFromListen(listen string) int {
	parts := strings.Split(listen, ":")
	if len(parts) >= 1 {
		port, _ := strconv.Atoi(parts[len(parts)-1])
		return port
	}
	return 0
}

type UpdateContainerRequest struct {
	CPU        int64        `json:"cpu"`
	Memory     int64        `json:"memory"`
	DiskMax    int64        `json:"diskMax"`
	EnableSwap bool         `json:"enableSwap"`
	Config     map[string]string `json:"config"`
}

func UpdateContainer(c *gin.Context) {
	name := c.Param("name")

	var req UpdateContainerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	inst, etag, err := incus.DefaultClient.GetInstance(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "container not found"})
		return
	}

	config := inst.Config
	if req.Config != nil {
		for k, v := range req.Config {
			config[k] = v
		}
	}

	if req.CPU > 0 {
		config["limits.cpu"] = strconv.FormatInt(req.CPU, 10)
	}
	if req.Memory > 0 {
		config["limits.memory"] = formatMemory(req.Memory)
	}
	if req.DiskMax > 0 {
		config["limits.disk"] = formatDisk(req.DiskMax)
	}
	if req.EnableSwap {
		config["limits.memory.swap"] = "true"
	}

	updateReq := incusapi.InstancePut{
		Config:  config,
		Devices: inst.Devices,
	}

	op, err := incus.DefaultClient.UpdateInstance(name, updateReq, etag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"operation": op.ID(),
		"message":   "container update initiated",
	})
}

func DeleteContainer(c *gin.Context) {
	name := c.Param("name")

	op, err := incus.DefaultClient.DeleteInstance(name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"operation": op.ID(),
		"message":   "container deletion initiated",
	})
}

func StartContainer(c *gin.Context) {
	name := c.Param("name")

	op, err := incus.DefaultClient.StartInstance(name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"operation": op.ID(),
		"message":   "container start initiated",
	})
}

func StopContainer(c *gin.Context) {
	name := c.Param("name")

	op, err := incus.DefaultClient.StopInstance(name, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"operation": op.ID(),
		"message":   "container stop initiated",
	})
}

func RestartContainer(c *gin.Context) {
	name := c.Param("name")

	op, err := incus.DefaultClient.RestartInstance(name, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"operation": op.ID(),
		"message":   "container restart initiated",
	})
}

func parseInt64(s string) int64 {
	var result int64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			result = result*10 + int64(c-'0')
		}
	}
	return result
}

func parseMemory(s string) int64 {
	var result int64
	var multiplier int64 = 1

	for _, c := range s {
		if c >= '0' && c <= '9' {
			result = result*10 + int64(c-'0')
		} else if c == 'G' || c == 'g' {
			multiplier = 1024 * 1024 * 1024
		} else if c == 'M' || c == 'm' {
			multiplier = 1024 * 1024
		} else if c == 'K' || c == 'k' {
			multiplier = 1024
		}
	}

	return result * multiplier / (1024 * 1024)
}

func parseDisk(s string) int64 {
	var result int64
	var multiplier int64 = 1

	for _, c := range s {
		if c >= '0' && c <= '9' {
			result = result*10 + int64(c-'0')
		} else if c == 'G' || c == 'g' {
			multiplier = 1024 * 1024 * 1024
		} else if c == 'T' || c == 't' {
			multiplier = 1024 * 1024 * 1024 * 1024
		}
	}

	return result * multiplier / (1024 * 1024 * 1024)
}

func formatMemory(mb int64) string {
	if mb >= 1024 {
		return fmt.Sprintf("%dGB", mb/1024)
	}
	return fmt.Sprintf("%dMB", mb)
}

func formatDisk(gb int64) string {
	return fmt.Sprintf("%dGB", gb)
}

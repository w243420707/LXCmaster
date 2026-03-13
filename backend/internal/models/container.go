package models

type Container struct {
	Name     string            `json:"name"`
	Status   string            `json:"status"`
	State    ContainerState    `json:"state"`
	Config   ContainerConfig   `json:"config"`
	Networks map[string]Network `json:"networks"`
}

type ContainerState struct {
	Pid        int    `json:"pid"`
	Status     string `json:"status"`
	CPUUsage   int64  `json:"cpu_usage"`
	MemoryUsed int64  `json:"memory_used"`
	MemoryMax  int64  `json:"memory_max"`
}

type ContainerConfig struct {
	CPU     CPUConfig     `json:"cpu"`
	Memory  MemoryConfig  `json:"memory"`
	Devices []Device      `json:"devices"`
}

type CPUConfig struct {
	Cores    int    `json:"cores"`
	Priority int    `json:"priority"`
	Limit    string `json:"limit"`
}

type MemoryConfig struct {
	Limit string `json:"limit"`
	Swap  string `json:"swap"`
}

type Device struct {
	Name       string            `json:"name"`
	Type       string            `json:"type"`
	Properties map[string]string `json:"properties"`
}

type Network struct {
	Name      string   `json:"name"`
	Type      string   `json:"type"`
	Addresses []string `json:"addresses"`
}

type PortMapping struct {
	Name        string `json:"name"`
	Protocol    string `json:"protocol"`
	HostPort    int    `json:"host_port"`
	ContainerIP string `json:"container_ip"`
	ContainerPort int  `json:"container_port"`
}

type CreateContainerRequest struct {
	Name       string            `json:"name"`
	Image      string            `json:"image"`
	CPU        CPUConfig         `json:"cpu"`
	Memory     MemoryConfig      `json:"memory"`
	Profiles   []string          `json:"profiles"`
	Config     map[string]string `json:"config"`
}

type UpdateContainerRequest struct {
	CPU     CPUConfig     `json:"cpu"`
	Memory  MemoryConfig  `json:"memory"`
	Devices []Device      `json:"devices"`
}

type OperationResponse struct {
	OperationID string `json:"operation_id"`
	Status      string `json:"status"`
}

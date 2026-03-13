package config

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
)

type Config struct {
	Server   ServerConfig   `json:"server"`
	Incus    IncusConfig    `json:"incus"`
	Database DatabaseConfig `json:"database"`
}

type ServerConfig struct {
	Port    int    `json:"port"`
	Host    string `json:"host"`
	DataDir string `json:"data_dir"`
}

type IncusConfig struct {
	SocketPath string `json:"socket_path"`
}

type DatabaseConfig struct {
	Path string `json:"path"`
}

var AppConfig *Config

func Load() *Config {
	AppConfig = &Config{
		Server: ServerConfig{
			Port:    2026,
			Host:    "0.0.0.0",
			DataDir: "/var/lib/lxcmaster",
		},
		Incus: IncusConfig{
			SocketPath: "/var/lib/incus/unix.socket",
		},
		Database: DatabaseConfig{
			Path: "/var/lib/lxcmaster/lxcmaster.db",
		},
	}

	configPaths := []string{
		"/var/lib/lxcmaster/config.json",
		"/opt/lxcmaster/data/config.json",
		"./config.json",
	}

	for _, configPath := range configPaths {
		if data, err := os.ReadFile(configPath); err == nil {
			if err := json.Unmarshal(data, AppConfig); err != nil {
				log.Printf("Warning: Failed to parse config file %s: %v", configPath, err)
			} else {
				log.Printf("Loaded config from %s", configPath)
				break
			}
		}
	}

	return AppConfig
}

func (c *Config) Save(path string) error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

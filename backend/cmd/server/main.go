package main

import (
	"flag"
	"fmt"
	"lxcmaster/internal/api"
	"lxcmaster/internal/config"
	"lxcmaster/internal/incus"
	"log"
	"os"
)

func main() {
	port := flag.Int("port", 0, "服务监听端口")
	flag.Parse()

	cfg := config.Load()

	if *port > 0 {
		cfg.Server.Port = *port
	}

	socketPath := cfg.Incus.SocketPath
	
	if _, err := os.Stat(socketPath); os.IsNotExist(err) {
		log.Printf("Configured socket path %s not found, auto-detecting...", socketPath)
		socketPath = incus.DetectSocketPath()
		log.Printf("Using socket path: %s", socketPath)
	}

	if err := incus.Init(socketPath); err != nil {
		log.Fatal("Failed to connect to Incus/LXD:", err)
	}

	log.Printf("Connected to Incus/LXD at %s", socketPath)

	router := api.SetupRouter(cfg)

	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	log.Printf("LXCmaster server starting on %s", addr)

	if err := router.Run(addr); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

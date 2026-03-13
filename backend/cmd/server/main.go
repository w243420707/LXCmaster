package main

import (
	"flag"
	"fmt"
	"lxcmaster/internal/api"
	"lxcmaster/internal/config"
	"lxcmaster/internal/incus"
	"log"
)

func main() {
	port := flag.Int("port", 0, "服务监听端口")
	flag.Parse()

	cfg := config.Load()

	if *port > 0 {
		cfg.Server.Port = *port
	}

	if err := incus.Init(cfg.Incus.SocketPath); err != nil {
		log.Fatal("Failed to connect to Incus:", err)
	}

	router := api.SetupRouter(cfg)

	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	log.Printf("LXCmaster server starting on %s", addr)

	if err := router.Run(addr); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

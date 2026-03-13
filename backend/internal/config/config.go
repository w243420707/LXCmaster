package config

type Config struct {
	Server   ServerConfig
	Incus    IncusConfig
	Database DatabaseConfig
}

type ServerConfig struct {
	Port    int
	Host    string
	DataDir string
}

type IncusConfig struct {
	SocketPath string
}

type DatabaseConfig struct {
	Path string
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
	return AppConfig
}

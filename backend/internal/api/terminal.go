package api

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/lxc/incus/shared/api"
	"lxcmaster/internal/incus"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func ExecContainer(c *gin.Context) {
	name := c.Param("name")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	execReq := api.InstanceExecPost{
		Command:     []string{"/bin/bash", "-l"},
		WaitForWS:   true,
		Interactive: true,
		Width:       80,
		Height:      24,
	}

	op, err := incus.DefaultClient.ExecInstance(name, execReq)
	if err != nil {
		conn.WriteMessage(websocket.TextMessage, []byte("Error: "+err.Error()))
		return
	}

	opAPI := op.Get()
	wsURL := ""
	for k, v := range opAPI.Metadata {
		if k == "fds" {
			if fds, ok := v.(map[string]interface{}); ok {
				if control, ok := fds["control"].(string); ok {
					wsURL = control
				}
			}
		}
	}

	if wsURL == "" {
		conn.WriteMessage(websocket.TextMessage, []byte("Error: no websocket URL"))
		return
	}

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return
			}
			_ = data
		}
	}()

	go func() {
		defer wg.Done()
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return
			}
			_ = data
		}
	}()

	wg.Wait()
}

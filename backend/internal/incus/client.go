package incus

import (
	"fmt"
	"net/http"
	"net/url"
	"os"

	incus "github.com/lxc/incus/client"
	"github.com/lxc/incus/shared/api"
)

type Client struct {
	client incus.InstanceServer
}

var DefaultClient *Client

func NewClient(socketPath string) (*Client, error) {
	if _, err := os.Stat(socketPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("incus socket not found at %s", socketPath)
	}

	client, err := incus.ConnectIncusUnix(socketPath, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to incus: %w", err)
	}

	return &Client{client: client}, nil
}

func Init(socketPath string) error {
	var err error
	DefaultClient, err = NewClient(socketPath)
	return err
}

func (c *Client) ListInstances() ([]api.Instance, error) {
	return c.client.GetInstances(api.InstanceTypeAny)
}

func (c *Client) GetInstance(name string) (*api.Instance, string, error) {
	return c.client.GetInstance(name)
}

func (c *Client) CreateInstance(req api.InstancesPost) (incus.Operation, error) {
	return c.client.CreateInstance(req)
}

func (c *Client) DeleteInstance(name string) (incus.Operation, error) {
	return c.client.DeleteInstance(name)
}

func (c *Client) UpdateInstance(name string, config api.InstancePut, ETag string) (incus.Operation, error) {
	return c.client.UpdateInstance(name, config, ETag)
}

func (c *Client) StartInstance(name string) (incus.Operation, error) {
	return c.client.UpdateInstanceState(name, api.InstanceStatePut{Action: "start"}, "")
}

func (c *Client) StopInstance(name string, force bool) (incus.Operation, error) {
	return c.client.UpdateInstanceState(name, api.InstanceStatePut{Action: "stop", Force: force}, "")
}

func (c *Client) RestartInstance(name string, force bool) (incus.Operation, error) {
	return c.client.UpdateInstanceState(name, api.InstanceStatePut{Action: "restart", Force: force}, "")
}

func (c *Client) GetInstanceState(name string) (*api.InstanceState, string, error) {
	return c.client.GetInstanceState(name)
}

func (c *Client) ListImages() ([]api.Image, error) {
	return c.client.GetImages()
}

func (c *Client) GetImageAliases() ([]api.ImageAliasesEntry, error) {
	return c.client.GetImageAliases()
}

func (c *Client) ListNetworks() ([]api.Network, error) {
	return c.client.GetNetworks()
}

func (c *Client) ListStoragePools() ([]api.StoragePool, error) {
	return c.client.GetStoragePools()
}

func (c *Client) ExecInstance(name string, req api.InstanceExecPost) (incus.Operation, error) {
	return c.client.ExecInstance(name, req, nil)
}

func (c *Client) GetInstanceConsole(name string) (*http.Response, error) {
	u := fmt.Sprintf("/1.0/instances/%s/console", url.PathEscape(name))
	return c.client.DoHTTP(&http.Request{
		Method: "GET",
		URL:    &url.URL{Path: u},
	})
}

func (c *Client) GetOperationWait(opID string, timeout int) (*api.Operation, string, error) {
	return c.client.GetOperationWait(opID, timeout)
}

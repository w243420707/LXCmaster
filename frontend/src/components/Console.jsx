import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

function Console({ containerName }) {
  const terminalRef = useRef(null)
  const termRef = useRef(null)
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#eee',
      },
      fontSize: 14,
      fontFamily: 'Consolas, Monaco, monospace',
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()

    termRef.current = term

    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${
        window.location.host
      }/api/containers/${containerName}/exec`
    )

    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      term.writeln('Connected to container console...')
    }

    ws.onmessage = (event) => {
      term.write(event.data)
    }

    ws.onclose = () => {
      setConnected(false)
      term.writeln('\r\nConnection closed.')
    }

    ws.onerror = () => {
      term.writeln('\r\nConnection error.')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      ws.close()
      term.dispose()
    }
  }, [containerName])

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-sm text-gray-400">终端 - {containerName}</span>
      </div>
      <div ref={terminalRef} className="p-2" style={{ minHeight: '400px' }} />
    </div>
  )
}

export default Console

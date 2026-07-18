import { useState } from 'react';
import {
  WasmWsTransport,
  WasmWsModbusClient,
  requestSerialPort,
  WasmRtuTransport,
  WasmAsciiTransport,
  WasmSerialModbusClient
} from 'modbus-rs';

type ConnectionMode = 'tcp' | 'serial';
type SerialProtocol = 'rtu' | 'ascii';

export default function App() {
  // Tabs & Settings State
  const [mode, setMode] = useState<ConnectionMode>('tcp');
  const [unitId, setUnitId] = useState(1);
  const [startAddress, setStartAddress] = useState(0);
  const [quantity, setQuantity] = useState(10);

  // TCP Specific State
  const [gatewayUrl, setGatewayUrl] = useState('ws://127.0.0.1:8080/modbus');

  // Serial Specific State
  const [protocol, setProtocol] = useState<SerialProtocol>('rtu');
  const [baudRate, setBaudRate] = useState(9600);
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');

  // Client & Connection State
  const [transport, setTransport] = useState<WasmWsTransport | WasmRtuTransport | WasmAsciiTransport | null>(null);
  const [client, setClient] = useState<WasmWsModbusClient | WasmSerialModbusClient | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');

  // Operations & Display State
  const [registers, setRegisters] = useState<Uint16Array | null>(null);
  const [reading, setReading] = useState(false);

  const handleConnectTcp = async () => {
    setStatus('connecting');
    setErrorMessage('');

    try {
      const newTransport = await WasmWsTransport.connect({
        wsUrl: gatewayUrl,
        requestTimeoutMs: 3000
      });
      const newClient = newTransport.createClient({ unitId });

      setTransport(newTransport);
      setClient(newClient);
      setStatus('connected');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || String(err));
      setStatus('error');
    }
  };

  const handleConnectSerial = async () => {
    setStatus('connecting');
    setErrorMessage('');

    try {
      // 1. Request port selection from user (requires a user click gesture)
      console.log("Requesting user to select a serial port...");
      const portHandle = await requestSerialPort();

      // 2. Open the selected transport based on the protocol
      console.log(`Opening serial port in ${protocol.toUpperCase()} mode...`);
      const options = {
        baudRate,
        parity,
        requestTimeoutMs: 2000
      };

      const newTransport = protocol === 'rtu'
        ? await WasmRtuTransport.open(portHandle, options)
        : await WasmAsciiTransport.open(portHandle, options);

      const newClient = newTransport.createClient({ unitId });

      setTransport(newTransport);
      setClient(newClient);
      setStatus('connected');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || String(err));
      setStatus('error');
    }
  };

  const handleDisconnect = () => {
    if (transport) {
      transport.close();
    }
    setTransport(null);
    setClient(null);
    setStatus('disconnected');
    setRegisters(null);
  };

  const handleRead = async () => {
    if (!client) return;
    setReading(true);
    setErrorMessage('');
    try {
      const data = await client.readHoldingRegisters({
        address: startAddress,
        quantity: quantity
      });
      setRegisters(data);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Read failed: ${err.message || String(err)}`);
    } finally {
      setReading(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{globalCss}</style>

      <div style={styles.card}>
        <h1 style={styles.title}>Modbus Client Dashboard</h1>
        <p style={styles.subtitle}>Powered by Rust WebAssembly & React</p>

        {/* Connection Mode Selection Tab */}
        {status === 'disconnected' && (
          <div style={styles.tabContainer}>
            <button
              style={mode === 'tcp' ? styles.tabActive : styles.tabInactive}
              onClick={() => setMode('tcp')}
            >
              TCP (WebSocket Gateway)
            </button>
            <button
              style={mode === 'serial' ? styles.tabActive : styles.tabInactive}
              onClick={() => setMode('serial')}
            >
              Serial (Web Serial API)
            </button>
          </div>
        )}

        {/* Status Indicator */}
        <div style={styles.statusRow}>
          <span style={styles.statusLabel}>
            Connection Mode: <strong>{mode.toUpperCase()}</strong>
          </span>
          <span style={{
            ...styles.badge,
            backgroundColor: statusColors[status].bg,
            color: statusColors[status].text
          }}>
            {status.toUpperCase()}
          </span>
        </div>

        {errorMessage && (
          <div style={styles.errorBanner}>
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        {/* Connection Form */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>1. Connection Settings</h2>

          {mode === 'tcp' ? (
            /* TCP CONFIGURATION */
            <div style={styles.formGroup}>
              <label style={styles.label}>WebSocket Gateway URL</label>
              <input
                style={styles.input}
                type="text"
                value={gatewayUrl}
                onChange={e => setGatewayUrl(e.target.value)}
                disabled={status === 'connected' || status === 'connecting'}
              />
            </div>
          ) : (
            /* SERIAL CONFIGURATION */
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Protocol</label>
                <select
                  style={styles.select}
                  value={protocol}
                  onChange={e => setProtocol(e.target.value as SerialProtocol)}
                  disabled={status === 'connected' || status === 'connecting'}
                >
                  <option value="rtu">RTU</option>
                  <option value="ascii">ASCII</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Baud Rate</label>
                <select
                  style={styles.select}
                  value={baudRate}
                  onChange={e => setBaudRate(Number(e.target.value))}
                  disabled={status === 'connected' || status === 'connecting'}
                >
                  <option value="9600">9600</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="115200">115200</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Parity</label>
                <select
                  style={styles.select}
                  value={parity}
                  onChange={e => setParity(e.target.value as any)}
                  disabled={status === 'connected' || status === 'connecting'}
                >
                  <option value="none">None (1 Stop Bit)</option>
                  <option value="even">Even (1 Stop Bit)</option>
                  <option value="odd">Odd (1 Stop Bit)</option>
                </select>
              </div>
            </div>
          )}

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Unit ID</label>
              <input
                style={styles.input}
                type="number"
                value={unitId}
                onChange={e => setUnitId(Number(e.target.value))}
                disabled={status === 'connected' || status === 'connecting'}
              />
            </div>

            <div style={styles.buttonContainer}>
              {status === 'connected' ? (
                <button style={styles.buttonDisconnect} onClick={handleDisconnect}>
                  Disconnect
                </button>
              ) : (
                <button
                  style={styles.buttonConnect}
                  onClick={mode === 'tcp' ? handleConnectTcp : handleConnectSerial}
                  disabled={status === 'connecting'}
                >
                  {status === 'connecting'
                    ? 'Connecting...'
                    : mode === 'tcp' ? 'Connect' : 'Select Port & Connect'
                  }
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Operations Form */}
        <div style={{ ...styles.section, opacity: status === 'connected' ? 1 : 0.5 }}>
          <h2 style={styles.sectionTitle}>2. Read Holding Registers (FC03)</h2>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Start Address</label>
              <input
                style={styles.input}
                type="number"
                value={startAddress}
                onChange={e => setStartAddress(Number(e.target.value))}
                disabled={status !== 'connected'}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Quantity</label>
              <input
                style={styles.input}
                type="number"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                disabled={status !== 'connected'}
              />
            </div>

            <div style={styles.buttonContainer}>
              <button
                style={styles.buttonRead}
                onClick={handleRead}
                disabled={status !== 'connected' || reading}
              >
                {reading ? 'Reading...' : 'Read Registers'}
              </button>
            </div>
          </div>
        </div>

        {/* Data Display */}
        {registers && registers.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Register Data Output</h2>
            <div style={styles.grid}>
              {Array.from(registers).map((val, idx) => (
                <div key={idx} style={styles.gridItem}>
                  <div style={styles.gridItemLabel}>Address {startAddress + idx}</div>
                  <div style={styles.gridItemValue}>
                    {val} <span style={styles.hex}>({toHex(val)})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const toHex = (num: number) => {
  return '0x' + num.toString(16).toUpperCase().padStart(4, '0');
};

const statusColors = {
  disconnected: { bg: '#2d3748', text: '#a0aec0' },
  connecting: { bg: '#2b6cb0', text: '#ebf8ff' },
  connected: { bg: '#2f855a', text: '#f0fff4' },
  error: { bg: '#c53030', text: '#fff5f5' }
};

const globalCss = `
  body {
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(circle at top right, #1a202c 0%, #0f172a 100%);
    color: #e2e8f0;
    min-height: 100vh;
  }
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '24px',
    boxSizing: 'border-box' as const
  },
  card: {
    background: 'rgba(30, 41, 59, 0.45)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '640px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
    boxSizing: 'border-box' as const
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    background: 'linear-gradient(to right, #63b3ed, #4fd1c5)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textAlign: 'center' as const
  },
  subtitle: {
    margin: '8px 0 20px 0',
    fontSize: '14px',
    color: '#94a3b8',
    textAlign: 'center' as const
  },
  tabContainer: {
    display: 'flex',
    background: 'rgba(15, 23, 42, 0.4)',
    borderRadius: '8px',
    padding: '4px',
    marginBottom: '20px',
    gap: '4px'
  },
  tabActive: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.08)',
    border: 'none',
    borderRadius: '6px',
    color: '#f8fafc',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  tabInactive: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#94a3b8',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    marginBottom: '24px'
  },
  statusLabel: {
    fontSize: '14px',
    color: '#cbd5e1'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.05em',
    transition: 'all 0.3s ease'
  },
  errorBanner: {
    padding: '12px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#fca5a5',
    fontSize: '14px',
    marginBottom: '24px'
  },
  section: {
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    marginBottom: '20px',
    transition: 'opacity 0.3s ease'
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#f8fafc'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    flex: 1
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px'
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    marginTop: '12px',
    alignItems: 'flex-end'
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  },
  input: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#f1f5f9',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box' as const
  },
  select: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    padding: '9px 14px',
    color: '#f1f5f9',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box' as const
  },
  buttonContainer: {
    display: 'flex',
    alignItems: 'stretch'
  },
  buttonConnect: {
    background: 'linear-gradient(to right, #3182ce, #319795)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 24px',
    height: '38px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  buttonDisconnect: {
    background: '#4a5568',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 24px',
    height: '38px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  buttonRead: {
    background: 'linear-gradient(to right, #d69e2e, #dd6b20)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 24px',
    height: '38px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
    marginTop: '12px'
  },
  gridItem: {
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'center' as const
  },
  gridItemLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    marginBottom: '4px'
  },
  gridItemValue: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#f1f5f9'
  },
  hex: {
    fontSize: '10px',
    fontWeight: 'normal',
    color: '#63b3ed'
  }
};

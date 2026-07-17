/**
 * Modbus WASM Browser Integration Example
 * 
 * This file demonstrates how to import and use the Modbus TCP/RTU library
 * inside a browser or frontend environment (via Vite, Webpack, etc.).
 * 
 * Because of our conditional exports, importing from 'modbus-rs' inside a
 * browser build target resolves automatically to the browser/WASM entrypoint
 * and displays ONLY WASM-specific types and helpers.
 */

// 1. Import WebAssembly exports directly from the main package name.
// When compiled by a bundler (Vite, Webpack), the WASM binary is loaded
// automatically, so no manual init() call is required.
import { WasmWsTransport, WasmWsModbusClient } from 'modbus-rs';

async function runBrowserApp() {
  console.log("Initializing browser Modbus application...");

  // 2. Connect to a Modbus TCP server via WebSocket gateway bridge.
  // Browsers cannot open raw TCP sockets due to sandbox restrictions,
  // so we connect over WebSockets to a modbus gateway.
  const websocketGatewayUrl = "ws://127.0.0.1:8080/modbus";

  try {
    console.log(`Connecting to WebSocket gateway at: ${websocketGatewayUrl}`);
    const transport = await WasmWsTransport.connect({
      wsUrl: websocketGatewayUrl,
      requestTimeoutMs: 3000
    });

    // 3. Create a Modbus client instance with a specific target unit ID
    const client: WasmWsModbusClient = transport.createClient({ unitId: 1 });

    // 4. Read Holding Registers (FC 03)
    console.log("Reading registers...");
    const registers: Uint16Array = await client.readHoldingRegisters({
      address: 0,
      quantity: 10
    });

    console.log("Read success! Register values:", Array.from(registers));

    // Cleanup
    transport.close();
  } catch (error) {
    console.error("Modbus connection or request failed:", error);
  }
}

// In a real application, run this on page load or on action trigger
runBrowserApp();

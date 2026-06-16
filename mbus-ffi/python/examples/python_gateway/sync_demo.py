"""Sync Modbus TCP gateway demo.

Pipeline:

    raw socket client ──▶ TcpGateway (127.0.0.1:5020) ──▶ AsyncTcpServer (127.0.0.1:<free>)

Run::
    # 1. Ensure you are using the virtual environment
    source .venv/bin/activate

    # 2. Build the python extension natively
    cd mbus-ffi 
    maturin develop --features python-client,python-gateway

    # 3. Run the demo script
    python examples/python_gateway/sync_demo.py
"""

from __future__ import annotations

import asyncio
import socket
import struct
import sys
import threading
import time
from contextlib import closing

import modbus_rs


GATEWAY_PORT = 5020
UNIT_ID = 1


class LoggingEventHandler(modbus_rs.GatewayEventHandler):
    def on_forward(self, session_id: int, unit_id: int, channel_idx: int) -> None:
        print(f"[EVENT] on_forward: session={session_id}, unit={unit_id}, channel={channel_idx}")

    def on_response_returned(self, session_id: int, upstream_txn: int) -> None:
        print(f"[EVENT] on_response_returned: session={session_id}, txn={upstream_txn}")

    def on_routing_miss(self, session_id: int, unit_id: int) -> None:
        print(f"[EVENT] on_routing_miss: session={session_id}, unit={unit_id}")

    def on_downstream_timeout(self, session_id: int, internal_txn: int) -> None:
        print(f"[EVENT] on_downstream_timeout: session={session_id}, internal_txn={internal_txn}")

    def on_upstream_disconnect(self, session_id: int) -> None:
        print(f"[EVENT] on_upstream_disconnect: session={session_id}")


class EchoApp(modbus_rs.ModbusApp):
    def handle_read_holding_registers(self, address: int, count: int):
        return [(address + i) & 0xFFFF for i in range(count)]


def free_port() -> int:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_port(host: str, port: int, timeout: float = 3.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.2):
                return
        except OSError:
            time.sleep(0.05)
    raise RuntimeError(f"port {host}:{port} not listening within {timeout}s")


def start_downstream(port: int) -> tuple[asyncio.AbstractEventLoop, threading.Thread]:
    """Spin up an EchoApp AsyncTcpServer in a background thread."""
    loop = asyncio.new_event_loop()
    ready = threading.Event()

    async def _run() -> None:
        server = modbus_rs.AsyncTcpServer("127.0.0.1", EchoApp(), port=port, unit_id=UNIT_ID)
        ready.set()
        try:
            await server.serve_forever()
        except asyncio.CancelledError:
            pass
        except Exception as exc:  # noqa: BLE001 — demo logs and exits
            print(f"[downstream] server stopped: {exc!r}", file=sys.stderr)

    def _thread() -> None:
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_run())
        except RuntimeError:
            # loop.stop() was called; expected during shutdown
            pass
        except Exception as exc:  # noqa: BLE001
            print(f"[downstream] event loop error: {exc!r}", file=sys.stderr)

    t = threading.Thread(target=_thread, daemon=True)
    t.start()
    ready.wait(timeout=3.0)
    wait_port("127.0.0.1", port)
    return loop, t


def stop_loop(loop: asyncio.AbstractEventLoop, thread: threading.Thread) -> None:
    loop.call_soon_threadsafe(loop.stop)
    thread.join(timeout=3)


def send_read_holding_registers(host: str, port: int, unit: int, start: int, qty: int) -> bytes:
    with socket.create_connection((host, port), timeout=5) as s:
        req = struct.pack(">HHHBBHH", 1, 0, 6, unit, 3, start, qty)
        s.sendall(req)
        hdr = s.recv(7)
        _txn, _proto, length, _unit = struct.unpack(">HHHB", hdr)
        body = b""
        while len(body) < length - 1:
            chunk = s.recv(length - 1 - len(body))
            if not chunk:
                break
            body += chunk
        return body


def main() -> None:
    downstream_port = free_port()
    print(f"Starting downstream Modbus server on 127.0.0.1:{downstream_port} (unit={UNIT_ID})")
    server_loop, server_thread = start_downstream(downstream_port)

    print(f"Starting sync TcpGateway on 127.0.0.1:{GATEWAY_PORT} with LoggingEventHandler")
    gw = modbus_rs.TcpGateway(
        f"127.0.0.1:{GATEWAY_PORT}",
        event_handler=LoggingEventHandler(),
    )
    ch = gw.add_tcp_downstream("127.0.0.1", downstream_port)
    gw.add_unit_route(unit=UNIT_ID, channel=ch)

    gw_thread = threading.Thread(target=gw.serve_forever, daemon=True)
    gw_thread.start()
    wait_port("127.0.0.1", GATEWAY_PORT)

    try:
        # Send a valid request
        print("\n--- Sending valid request (Unit 1) ---")
        body = send_read_holding_registers(
            "127.0.0.1", GATEWAY_PORT, unit=UNIT_ID, start=10, qty=4
        )
        regs = struct.unpack(">HHHH", body[2:10])
        print(f"OK: gateway returned registers {list(regs)} (expected [10, 11, 12, 13])")

        # Send a request with a routing miss
        print("\n--- Sending request with routing miss (Unit 99) ---")
        try:
            send_read_holding_registers(
                "127.0.0.1", GATEWAY_PORT, unit=99, start=10, qty=4
            )
        except Exception as exc:
            print(f"Expected exception received: {exc!r}")

        # Let the event handler callbacks run
        time.sleep(0.5)
        print("\nDemo complete. Shutting down...")
    finally:
        gw.stop()
        gw_thread.join(timeout=3)
        stop_loop(server_loop, server_thread)


if __name__ == "__main__":
    main()

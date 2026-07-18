#![allow(non_upper_case_globals, missing_docs)]
//! WASM error code constants and utilities.

use wasm_bindgen::prelude::*;

#[wasm_bindgen(inline_js = r#"
/**
 * Stable error codes for identifying Modbus-related errors.
 * These can be used with the `getModbusErrorCode` helper to check for specific error types.
 */
export const ModbusErrorCode = {
/** Exception thrown by a server handler when processing an invalid request. */
  EXCEPTION: 'MODBUS_EXCEPTION',
  /** Timeout occurred during Modbus operation. */
  TIMEOUT: 'MODBUS_TIMEOUT',
  /** Error during serial transport communication. */
  TRANSPORT: 'MODBUS_TRANSPORT',
  /** Invalid argument provided to a function. */
  INVALID_ARGUMENT: 'MODBUS_INVALID_ARGUMENT',
  /** Connection was closed during operation. */
  CONNECTION_CLOSED: 'MODBUS_CONNECTION_CLOSED',
  /** Unexpected internal error. */
  INTERNAL: 'MODBUS_INTERNAL',
};
"#)]
extern "C" {
    #[wasm_bindgen(thread_local_v2)]
    /// Stable error codes for identifying Modbus-related errors.
    pub static ModbusErrorCode: JsValue;
}

#[wasm_bindgen(typescript_custom_section)]
const TS_ERRORS: &'static str = r#"
/**
 * Stable error codes for identifying Modbus-related errors.
 * These can be used with the `getModbusErrorCode` helper to check for specific error types.
 */
export declare const ModbusErrorCode: {
  /** Exception thrown by a server handler when processing an invalid request. */
  readonly EXCEPTION: 'MODBUS_EXCEPTION'
  /** Timeout occurred during Modbus operation. */
  readonly TIMEOUT: 'MODBUS_TIMEOUT'
  /** Error during serial transport communication. */
  readonly TRANSPORT: 'MODBUS_TRANSPORT'
  /** Invalid argument provided to a function. */
  readonly INVALID_ARGUMENT: 'MODBUS_INVALID_ARGUMENT'
  /** Connection was closed during operation. */
  readonly CONNECTION_CLOSED: 'MODBUS_CONNECTION_CLOSED'
  /** Unexpected internal error. */
  readonly INTERNAL: 'MODBUS_INTERNAL'
}

/**
 * Extracts a stable error code from a Modbus error object.
 * @param err The error object.
 * @returns The corresponding code from `ModbusErrorCode`, or undefined if not a Modbus error.
 */
export declare function getModbusErrorCode(err: Error): string | undefined;
"#;

#[wasm_bindgen(js_name = "getModbusErrorCode", skip_typescript)]
/// Extracts a stable error code from a Modbus error object.
pub fn get_modbus_error_code(err: &JsValue) -> Option<String> {
    if err.is_null() || err.is_undefined() {
        return None;
    }
    let message = js_sys::Reflect::get(err, &JsValue::from_str("message")).ok()?;
    let msg_str = message.as_string()?;
    if msg_str.starts_with('[') {
        if let Some(end) = msg_str.find(']') {
            let code = &msg_str[1..end];
            if let Some(colon) = code.find(':') {
                return Some(code[..colon].to_string());
            } else {
                return Some(code.to_string());
            }
        }
    }
    None
}

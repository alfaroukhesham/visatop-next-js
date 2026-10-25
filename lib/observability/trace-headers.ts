/** Response / request header for the W3C trace id (32 hex chars). */
export const TRACE_ID_HEADER = "x-trace-id";

/** W3C Trace Context header. Propagated into Node so the SDK can continue the trace. */
export const TRACEPARENT_HEADER = "traceparent";

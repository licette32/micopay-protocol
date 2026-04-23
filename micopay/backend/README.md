# MicoPay Backend Error Taxonomy

This document defines the error codes and classes used in the MicoPay backend to provide consistent, support-safe messaging.

## Error Classes

| Class | HTTP Status | Description |
|-------|-------------|-------------|
| `AuthError` | 401/403 | Authentication or authorization failures. |
| `ValidationError` | 400/409/501 | Input validation, business logic violations, or unimplemented features. |
| `TradeStateError` | 409 | Invalid state transitions in the trade lifecycle. |
| `NotFoundError` | 404 | Resource not found. |
| `RateLimitError` | 429 | Too many requests. |
| `UpstreamError` | 502 | Failures in external systems (Stellar, RPC, etc.). |

## Error Codes

| Code | Class | User Message (Spanish) | Dev Message |
|------|-------|-----------------------|-------------|
| `AUTH_INVALID_CHALLENGE` | `AuthError` | El código de verificación no es válido o ha expirado. | Invalid or mismatched challenge provided |
| `AUTH_CHALLENGE_EXPIRED` | `AuthError` | El código de verificación ha expirado. | Challenge expired |
| `AUTH_INVALID_CREDENTIALS` | `AuthError` | La firma no es válida. | Invalid signature |
| `USER_NOT_FOUND` | `NotFoundError` | Usuario no encontrado. | User not found |
| `USER_ALREADY_EXISTS` | `ValidationError` | Ya existe un usuario con esa dirección o nombre de usuario. | User already exists |
| `TRADE_NOT_FOUND` | `NotFoundError` | El intercambio no existe. | Trade not found |
| `UNAUTHORIZED_ACCESS` | `AuthError` | No tienes permiso para ver este intercambio. | Not a participant |
| `UNAUTHORIZED_ACTION` | `AuthError` | Solo el [rol] puede realizar esta acción. | Only the [rol] can [action] |
| `INVALID_STATE` | `TradeStateError` | No se puede realizar esta acción en el estado actual. | Trade is in state X, expected Y |
| `INVALID_AMOUNT` | `ValidationError` | El monto debe ser entre 100 y 50,000 MXN. | Amount out of bounds |
| `STELLAR_SIMULATION_FAILED` | `UpstreamError` | No se pudo simular la transacción en Stellar. | Simulation failed |
| `STELLAR_SEND_FAILED` | `UpstreamError` | Error al enviar la transacción a Stellar. | Send failed |
| `STELLAR_TIMEOUT` | `UpstreamError` | La transacción está tardando más de lo esperado. | Tx not confirmed within 30s |
| `VALIDATION_ERROR` | (Global) | Por favor, verifica los datos ingresados. | Fastify validation error |
| `INTERNAL_ERROR` | (Global) | Ocurrió un error inesperado. | Unhandled error |

## JSON Response Shape

All errors follow this shape:

```json
{
  "code": "ERROR_CODE",
  "message": "User-safe message (Spanish)"
}
```

The `devMessage` is logged on the server but never exposed to the client.

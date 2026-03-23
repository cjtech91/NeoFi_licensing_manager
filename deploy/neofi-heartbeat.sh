#!/usr/bin/env bash
set -euo pipefail

WORKER_BASE_URL="${WORKER_BASE_URL:-}"
API_TOKEN="${API_TOKEN:-}"
LICENSE_KEY="${LICENSE_KEY:-}"
SYSTEM_SERIAL="${SYSTEM_SERIAL:-}"
DEVICE_MODEL="${DEVICE_MODEL:-}"

if [[ -z "${WORKER_BASE_URL}" ]]; then
  echo "WORKER_BASE_URL is required" >&2
  exit 2
fi

if [[ -z "${API_TOKEN}" ]]; then
  echo "API_TOKEN is required" >&2
  exit 2
fi

if [[ -z "${SYSTEM_SERIAL}" ]]; then
  if [[ -f /sys/firmware/devicetree/base/serial-number ]]; then
    SYSTEM_SERIAL="$(tr -d '\0' </sys/firmware/devicetree/base/serial-number | tr -d '[:space:]')"
  elif [[ -f /proc/device-tree/serial-number ]]; then
    SYSTEM_SERIAL="$(tr -d '\0' </proc/device-tree/serial-number | tr -d '[:space:]')"
  else
    SYSTEM_SERIAL=""
  fi
fi

if [[ -z "${SYSTEM_SERIAL}" ]]; then
  echo "SYSTEM_SERIAL is required (set SYSTEM_SERIAL env or provide /sys/firmware/devicetree/base/serial-number)" >&2
  exit 2
fi

if [[ -z "${DEVICE_MODEL}" ]]; then
  DEVICE_MODEL="$(uname -m 2>/dev/null || echo unknown)"
fi

payload="$(printf '{"system_serial":"%s","device_model":"%s","metadata":{"license_key":"%s"}}' \
  "${SYSTEM_SERIAL}" "${DEVICE_MODEL}" "${LICENSE_KEY}")"

curl -sS -X POST "${WORKER_BASE_URL%/}/heartbeat" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "${payload}" >/dev/null

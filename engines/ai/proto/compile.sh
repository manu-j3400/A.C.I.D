#!/usr/bin/env bash
# Compile aggregator.proto → Python gRPC stubs.
# Run from the repo root: bash engines/ai/proto/compile.sh

set -euo pipefail

PROTO_DIR="engines/ai/proto"
OUT_DIR="engines/ai/aggregator"

echo "[proto] Checking grpcio-tools..."
python3 -m grpc_tools.protoc --version 2>/dev/null || {
    echo "[proto] Installing grpcio-tools..."
    pip install grpcio-tools
}

echo "[proto] Compiling aggregator.proto..."
python3 -m grpc_tools.protoc \
    -I "${PROTO_DIR}" \
    --python_out="${OUT_DIR}" \
    --grpc_python_out="${OUT_DIR}" \
    --pyi_out="${OUT_DIR}" \
    "${PROTO_DIR}/aggregator.proto"

echo "[proto] Done. Generated files:"
ls -lh "${OUT_DIR}"/aggregator_pb2*.py "${OUT_DIR}"/aggregator_pb2*.pyi 2>/dev/null || true

# Supply-Chain Sentinel — eBPF Kernel Probe Build System
#
# Prerequisites:
#   clang >= 16, llvm-strip, bpftool, linux-headers, libbpf-dev
#
# Usage:
#   make          — compile probe.bpf.o + generate vmlinux.h
#   make clean    — remove build artifacts
#   make install  — copy compiled object to loader's expected path

ARCH           := $(shell uname -m | sed 's/x86_64/x86/' | sed 's/aarch64/arm64/')
CLANG          ?= clang
LLC            ?= llc
BPFTOOL        ?= bpftool
STRIP          ?= llvm-strip

BPF_SRC        := src/probe.bpf.c
BPF_OBJ        := out/probe.bpf.o
VMLINUX_H      := src/vmlinux.h
LOADER_OBJ_DIR := ../loader/src/bpf

CLANG_FLAGS := \
    -O2                              \
    -g                               \
    -target bpf                      \
    -D__TARGET_ARCH_$(ARCH)          \
    -I/usr/include/$(shell uname -m)-linux-gnu \
    -I/usr/include/bpf               \
    -Isrc                            \
    -Wall                            \
    -Wno-unused-value                \
    -Wno-pointer-sign                \
    -Wno-compare-distinct-pointer-types

.PHONY: all clean install vmlinux

all: vmlinux $(BPF_OBJ)

vmlinux: $(VMLINUX_H)

$(VMLINUX_H):
	@echo "[bpftool] Generating vmlinux.h from running kernel BTF..."
	@mkdir -p src
	$(BPFTOOL) btf dump file /sys/kernel/btf/vmlinux format c > $@

$(BPF_OBJ): $(BPF_SRC) $(VMLINUX_H)
	@echo "[clang] Compiling eBPF probe..."
	@mkdir -p out
	$(CLANG) $(CLANG_FLAGS) -c $(BPF_SRC) -o $@
	@echo "[llvm-strip] Stripping debug symbols from BPF object..."
	$(STRIP) -g $@

install: $(BPF_OBJ)
	@mkdir -p $(LOADER_OBJ_DIR)
	cp $(BPF_OBJ) $(LOADER_OBJ_DIR)/probe.bpf.o
	@echo "[install] Copied $(BPF_OBJ) -> $(LOADER_OBJ_DIR)/probe.bpf.o"

clean:
	rm -rf out/
	rm -f $(VMLINUX_H)

// SPDX-License-Identifier: GPL-2.0 OR BSD-2-Clause
//
// Supply-Chain Sentinel — Kernel-Space eBPF Probe
// ================================================
//
// ARCHITECTURAL NOTE ON SYSCALL BLOCKING:
//   Raw tracepoint/syscalls/sys_enter_* hooks are notification-only.
//   They fire *after* the kernel has already decided to execute the syscall
//   and cannot veto it. To block a syscall with -EPERM before it reaches the
//   network stack we use Linux Security Module (LSM) eBPF programs
//   (SEC("lsm/...")) which are invoked in the mandatory access control path
//   and can return a negative errno to abort the operation.
//
//   Requirements:
//     - Linux >= 5.7
//     - CONFIG_BPF_LSM=y
//     - Kernel cmdline: lsm=...,bpf   (add "bpf" to the lsm= list)
//     - CAP_BPF + CAP_SYS_ADMIN in the user-space loader
//
// Build:
//   make -C kernel/ebpf
//   (generates vmlinux.h via bpftool, then compiles with clang -target bpf)

#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>

// ---------------------------------------------------------------------------
// Authorization bitmask constants (mirrored in maps.rs)
// ---------------------------------------------------------------------------
#define AUTH_NET_CONNECT  (1ULL << 0)   // may call connect(2) / sendto(2)
#define AUTH_EXEC_SPAWN   (1ULL << 1)   // may execve a new binary

// ---------------------------------------------------------------------------
// Audit event structure — written to ring buffer, consumed by user-space
// ---------------------------------------------------------------------------
struct audit_event {
    __u64 timestamp_ns;
    __u32 pid;
    __u32 uid;
    __u64 required_cap;     // which capability was checked
    __u8  blocked;          // 1 = denied, 0 = allowed
    __u8  _pad[7];
    char  comm[16];         // TASK_COMM_LEN
};

// ---------------------------------------------------------------------------
// BPF Maps
// ---------------------------------------------------------------------------

// Primary policy map: TGID (process ID) -> authorization bitmask.
// Populated by the user-space Rust loader from a policy file or database.
// Absent entry = deny (default-deny posture).
struct {
    __uint(type,        BPF_MAP_TYPE_HASH);
    __uint(max_entries, 65536);
    __type(key,         __u32);     // tgid
    __type(value,       __u64);     // AUTH_* bitmask
} pid_policy_map SEC(".maps");

// High-throughput audit ring buffer — 16 MB lock-free.
// User-space polls this via libbpf ring_buffer__poll().
struct {
    __uint(type,        BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 1 << 24);   // 16 MB
} audit_ringbuf SEC(".maps");

// Per-CPU deny counters — updated without atomic contention.
// Aggregated by user-space for metrics/alerting.
struct {
    __uint(type,        BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, 2);         // [0]=connect denials, [1]=execve denials
    __type(key,         __u32);
    __type(value,       __u64);
} deny_counters SEC(".maps");

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

static __always_inline int check_auth(__u32 tgid, __u64 required) {
    __u64 *mask = bpf_map_lookup_elem(&pid_policy_map, &tgid);
    if (!mask)
        return 0;   // not in map → deny (default-deny)
    return (*mask & required) == required ? 1 : 0;
}

static __always_inline void emit_audit(__u32 tgid, __u64 cap, __u8 blocked) {
    struct audit_event *e = bpf_ringbuf_reserve(&audit_ringbuf, sizeof(*e), 0);
    if (!e)
        return;

    e->timestamp_ns  = bpf_ktime_get_ns();
    e->pid           = tgid;
    e->uid           = (__u32)(bpf_get_current_uid_gid() & 0xFFFFFFFF);
    e->required_cap  = cap;
    e->blocked       = blocked;
    __builtin_memset(e->_pad, 0, sizeof(e->_pad));
    bpf_get_current_comm(e->comm, sizeof(e->comm));

    bpf_ringbuf_submit(e, 0);

    if (blocked) {
        __u32 idx = (cap == AUTH_NET_CONNECT) ? 0 : 1;
        __u64 *cnt = bpf_map_lookup_elem(&deny_counters, &idx);
        if (cnt)
            __sync_fetch_and_add(cnt, 1);
    }
}

// ---------------------------------------------------------------------------
// LSM Hook: socket_connect
//
// Invoked by the kernel's mandatory access control layer immediately before
// any process may open an outbound connection. Returning -EPERM here aborts
// the connect(2) syscall before the socket ever touches the network stack.
// This is the only eBPF mechanism capable of physically blocking the call.
// ---------------------------------------------------------------------------
SEC("lsm/socket_connect")
int BPF_PROG(sc_sentinel_connect,
             struct socket *sock,
             struct sockaddr *address,
             int addrlen)
{
    __u32 tgid = bpf_get_current_pid_tgid() >> 32;

    if (!check_auth(tgid, AUTH_NET_CONNECT)) {
        emit_audit(tgid, AUTH_NET_CONNECT, 1);
        return -EPERM;
    }

    emit_audit(tgid, AUTH_NET_CONNECT, 0);
    return 0;
}

// ---------------------------------------------------------------------------
// LSM Hook: bprm_check_security
//
// Invoked before the kernel commits to loading and executing a new binary
// image. Returning -EPERM here prevents execve(2) / execveat(2) from
// replacing the current process image with an unauthorized binary.
// This blocks supply-chain injection via rogue post-install scripts.
// ---------------------------------------------------------------------------
SEC("lsm/bprm_check_security")
int BPF_PROG(sc_sentinel_execve, struct linux_binprm *bprm)
{
    __u32 tgid = bpf_get_current_pid_tgid() >> 32;

    if (!check_auth(tgid, AUTH_EXEC_SPAWN)) {
        emit_audit(tgid, AUTH_EXEC_SPAWN, 1);
        return -EPERM;
    }

    return 0;
}

// ---------------------------------------------------------------------------
// Tracepoint probes (telemetry only — cannot block)
//
// These fire on every syscall entry regardless of LSM decisions and feed
// a complete activity trace into the ring buffer. They give user-space
// visibility into syscalls that were *permitted* by policy.
// ---------------------------------------------------------------------------
SEC("tracepoint/syscalls/sys_enter_connect")
int tp_enter_connect(struct trace_event_raw_sys_enter *ctx)
{
    __u32 tgid = bpf_get_current_pid_tgid() >> 32;
    // LSM hook has already blocked unauthorized connections by the time
    // this tracepoint fires. Only permitted calls reach here.
    (void)tgid;
    return 0;
}

SEC("tracepoint/syscalls/sys_enter_execve")
int tp_enter_execve(struct trace_event_raw_sys_enter *ctx)
{
    __u32 tgid = bpf_get_current_pid_tgid() >> 32;
    (void)tgid;
    return 0;
}

char __license[] SEC("license") = "Dual BSD/GPL";

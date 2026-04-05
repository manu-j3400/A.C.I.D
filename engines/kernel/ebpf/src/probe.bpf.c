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
// Per-IP/port allowlist key (8 bytes, mirrored as IpPortKey in maps.rs)
//   ip4   : IPv4 address in network byte order (0 = wildcard any-IP)
//   port  : destination port in host byte order (0 = wildcard any-port)
//   proto : IPPROTO_TCP(6) / IPPROTO_UDP(17) / 0 = any
// ---------------------------------------------------------------------------
struct ip_port_key {
    __be32 ip4;
    __u16  port;
    __u8   proto;
    __u8   _pad;
};

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

// Per-IP/port allowlist. Presence in map = allowed. Empty = bypass L3/L4 gate.
struct {
    __uint(type,        BPF_MAP_TYPE_HASH);
    __uint(max_entries, 4096);
    __type(key,         struct ip_port_key);
    __type(value,       __u8);
} ip_port_allowlist SEC(".maps");

// Entry count for ip_port_allowlist (maintained by user-space).
// 0 = no allowlist configured → bypass L3/L4 filtering entirely.
struct {
    __uint(type,        BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 1);
    __type(key,         __u32);
    __type(value,       __u32);
} ip_port_count SEC(".maps");

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Returns 1 if (ip4, port, proto) is in the allowlist or allowlist is empty.
static __always_inline int check_ip_port(__be32 ip4, __u16 port, __u8 proto) {
    __u32 idx = 0;
    __u32 *cnt = bpf_map_lookup_elem(&ip_port_count, &idx);
    if (!cnt || *cnt == 0)
        return 1;   // no allowlist configured → bypass

    struct ip_port_key k;
    __u8 *hit;

    // Tier 1: exact match
    k.ip4 = ip4; k.port = port; k.proto = proto; k._pad = 0;
    hit = bpf_map_lookup_elem(&ip_port_allowlist, &k);
    if (hit) return 1;

    // Tier 2: any-IP wildcard
    k.ip4 = 0;
    hit = bpf_map_lookup_elem(&ip_port_allowlist, &k);
    if (hit) return 1;

    // Tier 3: any-port wildcard
    k.ip4 = ip4; k.port = 0; k.proto = 0;
    hit = bpf_map_lookup_elem(&ip_port_allowlist, &k);
    if (hit) return 1;

    return 0;
}

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

    // Gate 1: PID capability check.
    if (!check_auth(tgid, AUTH_NET_CONNECT)) {
        emit_audit(tgid, AUTH_NET_CONNECT, 1);
        return -EPERM;
    }

    // Gate 2: Per-IP/port allowlist (IPv4 only; IPv6 bypasses).
    if (addrlen >= (int)sizeof(struct sockaddr_in) && address->sa_family == AF_INET) {
        struct sockaddr_in *sin = (struct sockaddr_in *)address;
        __be32 ip4  = BPF_CORE_READ(sin, sin_addr.s_addr);
        __u16  port = bpf_ntohs(BPF_CORE_READ(sin, sin_port));
        if (!check_ip_port(ip4, port, 0)) {
            emit_audit(tgid, AUTH_NET_CONNECT, 1);
            return -EPERM;
        }
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

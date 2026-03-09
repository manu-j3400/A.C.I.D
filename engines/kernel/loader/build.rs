// build.rs — Compile the eBPF C probe and generate a typed Rust skeleton.
//
// libbpf-cargo invokes clang with -target bpf and then runs bpftool gen skeleton
// to produce a `probe.skel.rs` file we include! into the binary.
// This means the BPF object is embedded directly in the loader ELF — no
// separate .o file distribution required.

use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let bpf_src = manifest_dir.join("../../ebpf/src/probe.bpf.c");
    let out_dir = manifest_dir.join("src/bpf");

    std::fs::create_dir_all(&out_dir).expect("Failed to create src/bpf directory");

    let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_else(|_| "x86_64".to_string());
    let bpf_arch = match arch.as_str() {
        "x86_64"  => "x86",
        "aarch64" => "arm64",
        "riscv64" => "riscv",
        other     => other,
    };

    libbpf_cargo::SkeletonBuilder::new()
        .source(&bpf_src)
        .clang_args(&[
            "-O2",
            "-g",
            &format!("-D__TARGET_ARCH_{bpf_arch}"),
            "-I/usr/include/bpf",
            // vmlinux.h lives next to the BPF source
            "-I../../ebpf/src",
        ])
        .build_and_generate(out_dir.join("probe.skel.rs"))
        .expect("eBPF skeleton build failed — ensure clang, bpftool, and libbpf-dev are installed");

    println!("cargo:rerun-if-changed=../../ebpf/src/probe.bpf.c");
    println!("cargo:rerun-if-changed=../../ebpf/src/vmlinux.h");
}

import { motion } from 'framer-motion';
import { Github, Linkedin, Globe, Cpu, Shield, Sparkles } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';

export default function About() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-600 selection:text-white pt-32 pb-24 px-6 overflow-x-hidden relative">
      <PublicNavbar />

      {/* Ambient Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-cyan-900/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 pt-10">

        {/* Founder Hero Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center mb-24"
        >
          {/* Main Hero Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 text-sm font-semibold mb-8"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="w-4 h-4" /> Founder & Engineer
          </motion.div>

          {/* Profile Identifier */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br from-blue-600/20 to-cyan-400/20 border-2 border-blue-500/30 flex items-center justify-center mb-8 shadow-[0_0_50px_-10px_rgba(59,130,246,0.3)] ring-1 ring-white/10 backdrop-blur-xl">
            <span className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-blue-200">MJ</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4 text-white drop-shadow-lg">
            Manu Jawahar
          </h1>

          <div className="text-xl md:text-2xl text-blue-400 font-medium mb-10 flex flex-col md:flex-row items-center gap-2 md:gap-4">
            <span>Building Soteria</span>
            <span className="hidden md:block text-neutral-600">•</span>
            <span className="text-neutral-300">CSE @ UC Irvine (1st Year)</span>
          </div>

          {/* Social Links Row */}
          <div className="flex flex-wrap justify-center gap-4 w-full max-w-2xl px-4">
            <a
              href="https://manujawahar.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/40 text-neutral-300 hover:text-white transition-all duration-300 group shadow-lg"
            >
              <Globe className="w-5 h-5 text-neutral-500 group-hover:text-blue-400 transition-colors" />
              <span className="text-sm font-bold">Personal Site</span>
            </a>
            <a
              href="https://github.com/manujawahar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/40 text-neutral-300 hover:text-white transition-all duration-300 group shadow-lg"
            >
              <Github className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors" />
              <span className="text-sm font-bold">GitHub</span>
            </a>
            <a
              href="https://linkedin.com/in/manujawahar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#0A66C2]/60 text-neutral-300 hover:text-white transition-all duration-300 group shadow-lg"
            >
              <Linkedin className="w-5 h-5 text-neutral-500 group-hover:text-[#0A66C2] transition-colors" />
              <span className="text-sm font-bold">LinkedIn</span>
            </a>
          </div>
        </motion.div>

        {/* Story Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Decorative line */}
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="pt-20 px-4 md:px-0">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1] mb-12 text-center text-white">
              Combating the rise of<br />
              <span className="text-blue-500">AI-generated bugs.</span>
            </h2>

            <div className="max-w-3xl mx-auto space-y-8 text-lg text-neutral-400 font-medium leading-relaxed">
              <p className="text-xl text-neutral-200 font-semibold border-l-2 border-blue-500 pl-6 py-2">
                I built Soteria out of a direct frustration with modern development habits.
              </p>

              <div className="space-y-6">
                <p>
                  With the explosive rise of AI coding assistants like Copilot and ChatGPT, programming has become exponentially faster. But there's a serious catch: it's also become exponentially easier to ship insecure, hallucinated, or fundamentally flawed code without fully understanding it.
                </p>
                <p>
                  As a CSE student, I saw this happening firsthand. Students and junior developers were blindly accepting AI suggestions—pasting SQL injections, exposing API keys, and deploying vulnerable logic because the code "looked right" and compiled successfully.
                </p>
                <p>
                  I realized that while AI is great at writing code, we need better tools to <strong className="text-white">verify</strong> and <strong className="text-white">understand</strong> that code.
                </p>
              </div>

              {/* Mission Bento */}
              <div className="grid sm:grid-cols-2 gap-6 pt-10">
                <div className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                  <Cpu className="w-8 h-8 text-blue-400 mb-6 group-hover:scale-110 group-hover:text-blue-300 transition-all duration-300" />
                  <h3 className="text-xl text-white font-bold mb-3">The Problem</h3>
                  <p className="text-base text-neutral-400 leading-relaxed">AI writes the code, but developers copy/paste it without realizing the security implications or architectural flaws.</p>
                </div>
                <div className="p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                  <Shield className="w-8 h-8 text-cyan-400 mb-6 group-hover:scale-110 group-hover:text-cyan-300 transition-all duration-300" />
                  <h3 className="text-xl text-white font-bold mb-3">The Solution</h3>
                  <p className="text-base text-neutral-400 leading-relaxed">Soteria acts as an educational firewall. It catches vulnerabilities early and explains them in plain English.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

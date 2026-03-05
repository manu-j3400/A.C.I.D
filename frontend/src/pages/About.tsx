import { motion } from 'framer-motion';
import { Github, Linkedin, Globe, Cpu, Shield, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import PublicNavbar from '@/components/PublicNavbar';

export default function About() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-600 selection:text-white overflow-x-hidden relative">
      <PublicNavbar />

      {/* Ambient Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-cyan-900/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 pt-32 pb-24 px-6">

        {/* Founder Hero Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center mb-24 pt-10"
        >

          {/* Profile Identifier */}
          <div className="w-32 h-32 md:w-40 md:h-40 bg-blue-600/20 border-4 border-blue-500 flex items-center justify-center mb-8 shadow-[6px_6px_0px_#1e3a5f] rotate-[-2deg] hover:rotate-0 hover:shadow-[3px_3px_0px_#1e3a5f] transition-all duration-200">
            <span className="text-4xl md:text-6xl font-black tracking-tighter text-white">MJ</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4 text-white drop-shadow-lg uppercase">
            Manu Jawahar
          </h1>

          <div className="text-xl md:text-2xl text-blue-400 font-mono font-bold mb-10 flex flex-col md:flex-row items-center gap-2 md:gap-4">
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
              className="flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 border-2 border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white transition-all duration-200 group shadow-[4px_4px_0px_#1e293b] hover:shadow-[2px_2px_0px_#1e293b] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              <Globe className="w-5 h-5 text-neutral-500 group-hover:text-blue-400 transition-colors" />
              <span className="text-sm font-mono font-bold uppercase">Personal Site</span>
            </a>
            <a
              href="https://github.com/manujawahar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 border-2 border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white transition-all duration-200 group shadow-[4px_4px_0px_#1e293b] hover:shadow-[2px_2px_0px_#1e293b] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              <Github className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors" />
              <span className="text-sm font-mono font-bold uppercase">GitHub</span>
            </a>
            <a
              href="https://linkedin.com/in/manujawahar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 border-2 border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white transition-all duration-200 group shadow-[4px_4px_0px_#1e293b] hover:shadow-[2px_2px_0px_#1e293b] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              <Linkedin className="w-5 h-5 text-neutral-500 group-hover:text-[#0A66C2] transition-colors" />
              <span className="text-sm font-mono font-bold uppercase">LinkedIn</span>
            </a>
          </div>
        </motion.div>

        {/* Story Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Decorative line */}
          <div className="absolute left-0 right-0 top-0 h-px bg-white/10" />

          <div className="pt-20 px-4 md:px-0">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.1] mb-12 text-center text-white uppercase">
              Combating the rise of<br />
              <span className="text-blue-400">AI-generated bugs.</span>
            </h2>

            <div className="max-w-3xl mx-auto space-y-8 text-lg text-neutral-400 font-medium leading-relaxed">
              <p className="text-xl text-neutral-200 font-bold border-l-4 border-cyan-500 pl-6 py-2">
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
                <div className="p-8 border-2 border-neutral-700 bg-neutral-900 shadow-[4px_4px_0px_#1e293b] hover:shadow-[2px_2px_0px_#1e293b] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 group">
                  <Cpu className="w-8 h-8 text-blue-400 mb-6 group-hover:scale-110 group-hover:text-blue-300 transition-all duration-200" />
                  <h3 className="text-xl text-white font-black mb-3 uppercase">The Problem</h3>
                  <p className="text-base text-neutral-400 leading-relaxed font-mono">AI writes the code, but developers copy/paste it without realizing the security implications or architectural flaws.</p>
                </div>
                <div className="p-8 border-2 border-neutral-700 bg-neutral-900 shadow-[4px_4px_0px_#1e293b] hover:shadow-[2px_2px_0px_#1e293b] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 group">
                  <Shield className="w-8 h-8 text-blue-400 mb-6 group-hover:scale-110 group-hover:text-cyan-300 transition-all duration-200" />
                  <h3 className="text-xl text-white font-black mb-3 uppercase">The Solution</h3>
                  <p className="text-base text-neutral-400 leading-relaxed font-mono">Soteria acts as an educational firewall. It catches vulnerabilities early and explains them in plain English.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── FOOTER ─── */}
      <footer className="border-t-2 border-neutral-800 bg-black text-neutral-400 py-16 text-sm font-mono relative">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/soteria-logo.png" alt="Soteria" className="h-8 w-8 rounded-none object-cover transition-transform group-hover:-translate-y-[2px]" />
            <span className="text-xl font-mono font-bold tracking-[0.15em] uppercase text-white">SOTERIA</span>
          </Link>
          <div className="flex gap-8 font-bold">
            <Link to="/about" className="hover:text-primary transition-colors uppercase cursor-pointer">About the Creator</Link>
            <a href="https://github.com/manujawahar/ACID" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors uppercase flex items-center gap-2 cursor-pointer">
              <Github className="w-4 h-4" /> Open Source
            </a>
          </div>
          <div className="text-neutral-500 text-[10px] tracking-widest uppercase">
            © {new Date().getFullYear()} Soteria. Built for builders.
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dna, ShieldCheck, Zap, Lock, Eye, Cpu, Database, Globe, Fingerprint } from 'lucide-react';

export default function Features() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-blue-200 to-cyan-400 bg-clip-text text-transparent">
            Advanced Security Features
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Enterprise-grade protection powered by cutting-edge AI and machine learning algorithms
          </p>
        </div>

        {/* Main Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 group">
            <CardHeader>
              <div className="mb-4 p-3 bg-gradient-to-br from-blue-500/15 to-sky-500/15 rounded-lg w-fit group-hover:from-blue-500/25 group-hover:to-sky-500/25 transition-all">
                <Dna className="w-10 h-10 text-blue-400" />
              </div>
              <CardTitle className="text-xl text-white font-semibold mb-2">
                Deep Analysis
              </CardTitle>
              <CardDescription className="text-slate-400">
                Neural network trained on millions of malware samples for accurate threat detection and classification
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 group">
            <CardHeader>
              <div className="mb-4 p-3 bg-gradient-to-br from-cyan-500/15 to-teal-500/15 rounded-lg w-fit group-hover:from-cyan-500/25 group-hover:to-teal-500/25 transition-all">
                <ShieldCheck className="w-10 h-10 text-cyan-400" />
              </div>
              <CardTitle className="text-xl text-white font-semibold mb-2">
                Real-time Protection
              </CardTitle>
              <CardDescription className="text-slate-400">
                Instant threat detection and classification with continuous monitoring and automatic updates
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800 hover:border-sky-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/20 group">
            <CardHeader>
              <div className="mb-4 p-3 bg-gradient-to-br from-sky-500/15 to-blue-500/15 rounded-lg w-fit group-hover:from-sky-500/25 group-hover:to-blue-500/25 transition-all">
                <Zap className="w-10 h-10 text-sky-400" />
              </div>
              <CardTitle className="text-xl text-white font-semibold mb-2">
                Lightning Fast
              </CardTitle>
              <CardDescription className="text-slate-400">
                Optimized inference engine delivering results in milliseconds with minimal resource usage
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Additional Features */}
        <div className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center text-white">
            Complete Security Suite
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-900/30 backdrop-blur-sm border-slate-800 hover:border-blue-500/30 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Lock className="w-6 h-6 text-blue-400" />
                  </div>
                  <CardTitle className="text-lg text-white">End-to-End Encryption</CardTitle>
                </div>
                <CardDescription className="text-slate-400 text-sm">
                  All code analysis is performed with military-grade encryption
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/30 backdrop-blur-sm border-slate-800 hover:border-cyan-500/30 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <Eye className="w-6 h-6 text-cyan-400" />
                  </div>
                  <CardTitle className="text-lg text-white">Behavioral Analysis</CardTitle>
                </div>
                <CardDescription className="text-slate-400 text-sm">
                  Advanced pattern recognition for zero-day threat detection
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/30 backdrop-blur-sm border-slate-800 hover:border-sky-500/30 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-sky-500/10 rounded-lg">
                    <Cpu className="w-6 h-6 text-sky-400" />
                  </div>
                  <CardTitle className="text-lg text-white">Machine Learning</CardTitle>
                </div>
                <CardDescription className="text-slate-400 text-sm">
                  Self-improving algorithms that adapt to new threats
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/30 backdrop-blur-sm border-slate-800 hover:border-blue-500/30 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Database className="w-6 h-6 text-blue-400" />
                  </div>
                  <CardTitle className="text-lg text-white">Threat Intelligence</CardTitle>
                </div>
                <CardDescription className="text-slate-400 text-sm">
                  Real-time updates from global threat databases
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/30 backdrop-blur-sm border-slate-800 hover:border-cyan-500/30 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <Globe className="w-6 h-6 text-cyan-400" />
                  </div>
                  <CardTitle className="text-lg text-white">Multi-Language Support</CardTitle>
                </div>
                <CardDescription className="text-slate-400 text-sm">
                  Analyze code in Python, JavaScript, Java, C++ and more
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/30 backdrop-blur-sm border-slate-800 hover:border-sky-500/30 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-sky-500/10 rounded-lg">
                    <Fingerprint className="w-6 h-6 text-sky-400" />
                  </div>
                  <CardTitle className="text-lg text-white">Signature Detection</CardTitle>
                </div>
                <CardDescription className="text-slate-400 text-sm">
                  Identify known malware variants with precision matching
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Comparison Section */}
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center text-white">
            Why Choose Soteria?
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-5xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                3x
              </div>
              <p className="text-slate-300 font-medium mb-1">Faster Detection</p>
              <p className="text-slate-500 text-sm">Than traditional antivirus</p>
            </div>
            <div>
              <div className="text-5xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                50%
              </div>
              <p className="text-slate-300 font-medium mb-1">Lower False Positives</p>
              <p className="text-slate-500 text-sm">More accurate predictions</p>
            </div>
            <div>
              <div className="text-5xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                100%
              </div>
              <p className="text-slate-300 font-medium mb-1">Open Source</p>
              <p className="text-slate-500 text-sm">Fully transparent algorithms</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

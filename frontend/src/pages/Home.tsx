import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Shield, Zap, Users, Award, TrendingUp, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
        <div className="mb-6 px-4 py-2 bg-gradient-to-r from-blue-500/15 to-cyan-500/15 border border-blue-400/40 rounded-full backdrop-blur-sm">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300 text-sm font-semibold tracking-wider">
            ADVANCED THREAT INTELLIGENCE
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-center mb-6 bg-gradient-to-r from-white via-blue-200 to-cyan-400 bg-clip-text text-transparent animate-gradient-x">
          SOTERIA
        </h1>

        <p className="text-xl md:text-2xl text-center mb-4 bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent font-semibold">
          AI-Powered Malware Detection Platform
        </p>

        <p className="text-base md:text-lg text-center mb-12 text-slate-400 max-w-2xl">
          The next generation of code security. Leveraging advanced neural networks to detect threats in real-time,
          Soteria protects millions of developers worldwide with enterprise-grade AI technology.
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          <Button
            size="lg"
            onClick={() => navigate('/scanner')}
            className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:via-blue-400 hover:to-cyan-400 text-white font-semibold text-base px-8 py-6 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 overflow-hidden group"
          >
            <span className="relative z-10">Try Free Scanner</span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/features')}
            className="border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/10 text-slate-300 hover:text-blue-300 font-semibold text-base px-8 py-6 transition-all duration-300"
          >
            Explore Features
          </Button>
        </div>

        {/* Stats Section */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl w-full">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              10k+
            </div>
            <div className="text-sm text-slate-400">Threats Analyzed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              97.9%
            </div>
            <div className="text-sm text-slate-400">Accuracy Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              &lt;0.01s
            </div>
            <div className="text-sm text-slate-400">Scan Time</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              5+
            </div>
            <div className="text-sm text-slate-400">Developers working on improving code quality</div>
          </div>
        </div>
      </section>

      {/* What is Soteria Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              What is Soteria?
            </h2>
            <p className="text-slate-400 text-lg max-w-3xl mx-auto">
              A revolutionary platform that combines artificial intelligence, machine learning, and advanced pattern recognition
              to provide real-time code security analysis. Born from the need for accessible, accurate, and fast malware detection.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500/15 to-sky-500/15 rounded-lg">
                    <Shield className="w-8 h-8 text-blue-400" />
                  </div>
                  <CardTitle className="text-2xl text-white">Built for Security</CardTitle>
                </div>
                <CardDescription className="text-slate-400 leading-relaxed text-base">
                  Every line of code is a potential vulnerability. Soteria was designed from the ground up to protect developers,
                  teams, and enterprises from evolving threats. Our AI doesn't just detect known malware—it predicts and prevents
                  zero-day attacks before they happen.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-cyan-500/15 to-teal-500/15 rounded-lg">
                    <Zap className="w-8 h-8 text-cyan-400" />
                  </div>
                  <CardTitle className="text-2xl text-white">Powered by AI</CardTitle>
                </div>
                <CardDescription className="text-slate-400 leading-relaxed text-base">
                  Our neural networks are trained on over 10 million malware samples, continuously learning from global threat databases.
                  Unlike traditional signature-based detection, our AI understands behavioral patterns and can identify sophisticated
                  threats in milliseconds.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* The Name Explained */}
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-8 md:p-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl">
                <Shield className="w-12 h-12 text-blue-400" />
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Why "Soteria"?</h3>
                <p className="text-blue-300">The Guardian of Your Code</p>
              </div>
            </div>
            <p className="text-slate-300 text-lg leading-relaxed mb-6">
              A <span className="text-blue-400 font-semibold">soteria</span> stands watch, vigilant and unwavering.
              <br />
              Soteria embodies this philosophy—an AI-powered watchdog that monitors, analyzes, and protects your
              In the digital realm, where threats lurk in every line of code, you need a guardian that never sleeps.
              Soteria embodies this philosophy—an AI-powered watchdog that monitors, analyzes, and protects your
              applications 24/7.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-blue-400 font-semibold mb-2">⚡ Always Vigilant</div>
                <p className="text-slate-400 text-sm">Continuous monitoring and real-time threat detection</p>
              </div>
              <div>
                <div className="text-cyan-400 font-semibold mb-2">🛡️ Proactive Defense</div>
                <p className="text-slate-400 text-sm">Preventing attacks before they can cause damage</p>
              </div>
              <div>
                <div className="text-blue-400 font-semibold mb-2">🤖 AI-Powered</div>
                <p className="text-slate-400 text-sm">Self-learning algorithms that evolve with threats</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Why Developers Trust Soteria
            </h2>
            <p className="text-slate-400 text-lg">
              Joining 500,000+ developers and teams worldwide
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800 hover:border-blue-500/30 transition-all">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-4 bg-gradient-to-br from-blue-500/15 to-sky-500/15 rounded-xl w-fit">
                  <Users className="w-10 h-10 text-blue-400" />
                </div>
                <CardTitle className="text-xl text-white mb-3">Developer-First</CardTitle>
                <CardDescription className="text-slate-400">
                  Built by developers, for developers. Simple API, clear documentation, and seamless integration
                  into any workflow or CI/CD pipeline.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800 hover:border-cyan-500/30 transition-all">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-4 bg-gradient-to-br from-cyan-500/15 to-teal-500/15 rounded-xl w-fit">
                  <Award className="w-10 h-10 text-cyan-400" />
                </div>
                <CardTitle className="text-xl text-white mb-3">Enterprise Grade</CardTitle>
                <CardDescription className="text-slate-400">
                  Trusted by Fortune 500 companies and startups alike. Military-grade encryption,
                  SOC 2 compliance, and 99.99% uptime SLA.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800 hover:border-sky-500/30 transition-all">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-4 bg-gradient-to-br from-sky-500/15 to-blue-500/15 rounded-xl w-fit">
                  <Globe className="w-10 h-10 text-sky-400" />
                </div>
                <CardTitle className="text-xl text-white mb-3">Open Source</CardTitle>
                <CardDescription className="text-slate-400">
                  Fully transparent algorithms and open-source core. Contribute, audit, or customize
                  to meet your specific security requirements.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-12 text-center">
            <TrendingUp className="w-16 h-16 text-blue-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Secure Your Code?
            </h2>
            <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of developers protecting their applications with AI-powered security.
              Start scanning for free—no credit card required.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button
                size="lg"
                onClick={() => navigate('/scanner')}
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold shadow-lg shadow-blue-500/30"
              >
                Start Free Scan
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/10 text-blue-300"
                asChild
              >
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <Github className="w-5 h-5 mr-2" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

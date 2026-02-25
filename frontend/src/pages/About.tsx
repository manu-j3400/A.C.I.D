import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Zap, Github, Check, Users, Award, Target } from 'lucide-react';
import { useState } from 'react';

export default function About() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      question: "How does Soteria detect malware?",
      answer: "We use advanced neural networks trained on millions of malware samples. Our AI analyzes code patterns, behavioral signatures, and known exploit techniques to identify threats with 99.8% accuracy."
    },
    {
      question: "Is my code stored or shared?",
      answer: "Absolutely not. All analysis is performed in real-time and your code is never stored on our servers. We take privacy seriously and use end-to-end encryption for all transmissions."
    },
    {
      question: "What programming languages are supported?",
      answer: "Currently we support Python, JavaScript, Java, C++, C#, PHP, Ruby, and Go. We're constantly adding support for more languages based on community feedback."
    },
    {
      question: "Can I use this for commercial projects?",
      answer: "Yes! Our open-source license allows both personal and commercial use. For enterprise features and support, check out our pricing plans."
    },
    {
      question: "How accurate is the detection?",
      answer: "Our system maintains a 99.8% accuracy rate with less than 1% false positives. We continuously improve our models with feedback from the security community."
    }
  ];

  return (
    <div className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-blue-200 to-cyan-400 bg-clip-text text-transparent">
            About Soteria
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Next-generation security platform powered by artificial intelligence and built for developers
          </p>
        </div>

        {/* Mission & Technology */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-500/15 to-sky-500/15 rounded-lg">
                  <Target className="w-6 h-6 text-blue-400" />
                </div>
                <CardTitle className="text-xl text-white">Our Mission</CardTitle>
              </div>
              <CardDescription className="text-slate-400 leading-relaxed">
                To democratize enterprise-grade security tools and make advanced threat detection accessible to developers worldwide. We believe in proactive security through AI-powered analysis and transparent, open-source technology.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-cyan-500/15 to-teal-500/15 rounded-lg">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
                <CardTitle className="text-xl text-white">Technology</CardTitle>
              </div>
              <CardDescription className="text-slate-400 leading-relaxed">
                Built on state-of-the-art neural networks trained on millions of malware samples. Our models continuously learn from new threats to stay ahead of emerging security risks and zero-day exploits.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Pricing Section */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-400 text-center mb-12">
            Choose the plan that fits your needs
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800 hover:border-blue-500/30 transition-all">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-white mb-2">Free</CardTitle>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">$0</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <CardDescription className="text-slate-400">Perfect for individual developers</CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">100 scans per month</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Basic threat detection</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Community support</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Open source license</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full border-slate-700 hover:border-blue-500/50">
                  Get Started
                </Button>
              </div>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm border-blue-500/50 hover:border-blue-500 transition-all relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-white mb-2">Pro</CardTitle>
                <div className="mb-4">
                  <span className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">$29</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <CardDescription className="text-slate-400">For professional developers & teams</CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Unlimited scans</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Advanced AI detection</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Priority support</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">API access</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Detailed reports</span>
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400">
                  Start Pro Trial
                </Button>
              </div>
            </Card>

            {/* Enterprise Plan */}
            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800 hover:border-cyan-500/30 transition-all">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-white mb-2">Enterprise</CardTitle>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">Custom</span>
                </div>
                <CardDescription className="text-slate-400">For large organizations</CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm">Everything in Pro</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm">Dedicated support</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm">Custom integrations</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm">SLA guarantees</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <Check className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm">On-premise deployment</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full border-slate-700 hover:border-cyan-500/50">
                  Contact Sales
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center text-white">
            Trusted by Developers
          </h2>
          <p className="text-slate-400 text-center mb-12">
            See what security professionals are saying about Soteria
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white">Sarah Chen</CardTitle>
                    <CardDescription className="text-xs">Senior Security Engineer</CardDescription>
                  </div>
                </div>
                <CardDescription className="text-slate-400">
                  "The best malware detection tool I've used. Fast, accurate, and the AI keeps getting better. Essential for our security pipeline."
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center">
                    <Award className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white">Marcus Rodriguez</CardTitle>
                    <CardDescription className="text-xs">DevSecOps Lead</CardDescription>
                  </div>
                </div>
                <CardDescription className="text-slate-400">
                  "Soteria caught vulnerabilities that other tools missed. The API integration was seamless and the results are incredibly detailed."
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-900/50 backdrop-blur-sm border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-sky-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-white">Emily Thompson</CardTitle>
                    <CardDescription className="text-xs">CTO at TechStart</CardDescription>
                  </div>
                </div>
                <CardDescription className="text-slate-400">
                  "Open source and transparent - exactly what we needed. The community support is amazing and the detection speed is unmatched."
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-400 text-center mb-12">
            Everything you need to know about Soteria
          </p>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                >
                  <span className="font-semibold text-white">{faq.question}</span>
                  <span className="text-blue-400 text-xl">{openFaq === index ? '−' : '+'}</span>
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 text-slate-400">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-8 text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-3 text-white">Open Source & Transparent</h3>
          <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
            We believe in transparency. Our detection algorithms and model architecture are open source, allowing the security community to audit, contribute, and improve our technology.
          </p>
          <Button
            variant="outline"
            className="border-blue-500/50 hover:border-blue-400 hover:bg-blue-500/10 text-blue-300 hover:text-blue-200"
            asChild
          >
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Github className="w-4 h-4 mr-2" />
              View on GitHub
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

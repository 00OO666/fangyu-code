import React from 'react';
import { GlassCard, GlassButton, GlassInput } from '@/components/ui/deep-glass';

/**
 * Deep Glass Components Demo
 *
 * This component demonstrates the Deep Glass UI components
 * in action. Use this to verify the visual effects.
 */
export const DeepGlassDemo: React.FC = () => {
  return (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-white">Deep Glass Components Demo</h1>
        <p className="text-white/70">
          Testing the new Deep Glass Pro AI Station V1 style components
        </p>
      </div>

      {/* Glass Cards */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Glass Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard intensity="deep" className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Deep Glass</h3>
            <p className="text-white/70">Maximum blur effect</p>
          </GlassCard>

          <GlassCard intensity="medium" className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Medium Glass</h3>
            <p className="text-white/70">Balanced blur effect</p>
          </GlassCard>

          <GlassCard intensity="light" className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Light Glass</h3>
            <p className="text-white/70">Subtle blur effect</p>
          </GlassCard>
        </div>
      </div>

      {/* Glow Border Cards */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Glow Border Effects</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard intensity="deep" glow glowColor="orange" className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Orange Glow</h3>
            <p className="text-white/70">Accent color glow</p>
          </GlassCard>

          <GlassCard intensity="deep" glow glowColor="white" className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">White Glow</h3>
            <p className="text-white/70">Neutral glow effect</p>
          </GlassCard>

          <GlassCard intensity="deep" glow glowColor="blue" className="p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Blue Glow</h3>
            <p className="text-white/70">Info color glow</p>
          </GlassCard>
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <GlassButton variant="orange" size="sm">
            Small Orange
          </GlassButton>
          <GlassButton variant="orange" size="md">
            Medium Orange
          </GlassButton>
          <GlassButton variant="orange" size="lg">
            Large Orange
          </GlassButton>
        </div>
        <div className="flex flex-wrap gap-4">
          <GlassButton variant="glass" size="md">
            Glass Button
          </GlassButton>
          <GlassButton variant="ghost" size="md">
            Ghost Button
          </GlassButton>
          <GlassButton variant="orange" size="md" loading>
            Loading...
          </GlassButton>
          <GlassButton variant="orange" size="md" disabled>
            Disabled
          </GlassButton>
        </div>
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Input Fields</h2>
        <div className="space-y-4 max-w-md">
          <GlassInput
            placeholder="Small input..."
            inputSize="sm"
          />
          <GlassInput
            placeholder="Medium input with glow..."
            inputSize="md"
            glow
          />
          <GlassInput
            placeholder="Large input..."
            inputSize="lg"
          />
        </div>
      </div>

      {/* Hover Effects */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Hover Effects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard intensity="deep" hover className="p-6 cursor-pointer">
            <h3 className="text-lg font-semibold text-white mb-2">Hover to Lift</h3>
            <p className="text-white/70">This card lifts on hover</p>
          </GlassCard>

          <GlassCard intensity="deep" glow glowColor="orange" hover className="p-6 cursor-pointer">
            <h3 className="text-lg font-semibold text-white mb-2">Glow + Hover</h3>
            <p className="text-white/70">Combined effects</p>
          </GlassCard>
        </div>
      </div>

      {/* Complex Example */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Complex Example</h2>
        <GlassCard intensity="deep" glow glowColor="orange" className="p-6 max-w-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Claude 3.5 Sonnet</h3>
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[var(--accent-orange)] to-[var(--accent-gold)] text-white text-sm font-medium">
                Active
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Tokens:</span>
                <span className="text-white font-medium">128k/200k (64%)</span>
              </div>
              <div className="progress-glass">
                <div className="progress-glass-fill" style={{ width: '64%' }} />
              </div>
            </div>

            <div className="flex gap-2">
              <GlassButton variant="orange" size="sm" className="flex-1">
                Execute
              </GlassButton>
              <GlassButton variant="glass" size="sm" className="flex-1">
                Cancel
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

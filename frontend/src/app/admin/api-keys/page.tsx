'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Key, Save, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminApiKeysPage() {
  const [apiKey, setApiKey] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await adminApi.getPaymentkuSettings();
        setApiKey(data.paymentku_api_key || '');
        setWebhookToken(data.webhook_token || '');
      } catch (err) {
        console.error('Failed to load API keys:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.savePaymentkuSettings({
        paymentku_api_key: apiKey,
        webhook_token: webhookToken,
      });
      toast.success('API keys saved successfully! 🔑');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#8A2BE2]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black text-[#1D1D23]">🔑 API Keys & Secrets</h2>

      <div className="neobrutal-box bg-white p-6 shadow-[4px_4px_0px_#1D1D23]">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-yellow-100 rounded-xl border-2 border-[#1D1D23]">
            <Shield className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[#1D1D23]">Paymentku Configuration</h3>
            <p className="text-sm text-gray-500 font-medium">Manage your payment gateway credentials</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-extrabold text-[#1D1D23] mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> Paymentku API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full py-3 px-4 pr-11 border-3 border-[#1D1D23] rounded-xl bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-mono text-sm transition-all"
                placeholder="pk_live_xxxxxxxxxxxxxxxx"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1D1D23]"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-extrabold text-[#1D1D23] mb-1.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Webhook Token (Secret)
            </label>
            <div className="relative">
              <input
                type={showWebhook ? 'text' : 'password'}
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                className="w-full py-3 px-4 pr-11 border-3 border-[#1D1D23] rounded-xl bg-[#FFFDF7] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2] font-mono text-sm transition-all"
                placeholder="whsec_xxxxxxxxxxxxxxxx"
              />
              <button
                type="button"
                onClick={() => setShowWebhook(!showWebhook)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1D1D23]"
              >
                {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 font-medium">Used to verify webhook signatures from Paymentku</p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="neobrutal-button px-8 py-3 bg-[#3B82F6] text-white flex items-center gap-2 text-sm disabled:opacity-50 hover:bg-[#4f8ff7]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save API Keys
            </button>
          </div>
        </form>
      </div>

      {/* Info Card */}
      <div className="neobrutal-box bg-purple-50 p-5 shadow-[4px_4px_0px_#8A2BE2]">
        <h4 className="text-sm font-extrabold text-[#8A2BE2] mb-2">💡 Webhook URL</h4>
        <p className="text-sm font-medium text-gray-600 mb-2">Set this URL in your Paymentku dashboard as the webhook endpoint:</p>
        <code className="block bg-white px-4 py-2.5 rounded-lg border-2 border-[#1D1D23] text-sm font-mono text-[#8A2BE2] break-all">
          {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/paymentku` : '/api/webhook/paymentku'}
        </code>
      </div>
    </div>
  );
}

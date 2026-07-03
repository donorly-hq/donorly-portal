"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AiConversation, AiInsight, AiSettings } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
  Tab,
  Tabs,
} from "@/components/ui";

export default function InsightsPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<"chat" | "org" | "history">("chat");

  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [togglingAi, setTogglingAi] = useState(false);

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const [orgInsight, setOrgInsight] = useState<AiInsight | null>(null);
  const [generatingOrg, setGeneratingOrg] = useState(false);

  const [recentInsights, setRecentInsights] = useState<AiInsight[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSettings();
    loadConversations();
    loadOrgInsight();
    loadRecentInsights();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations]);

  async function loadSettings() {
    const data = await apiFetch<AiSettings>("/api/ai/settings");
    if (data) setSettings(data);
  }

  async function loadConversations() {
    const data = await apiFetch<AiConversation[]>("/api/ai/conversations");
    if (data) setConversations(data.reverse());
  }

  async function loadOrgInsight() {
    const data = await apiFetch<AiInsight>("/api/ai/insights/org");
    if (data) setOrgInsight(data);
  }

  async function loadRecentInsights() {
    const data = await apiFetch<AiInsight[]>("/api/ai/insights");
    if (data) setRecentInsights(data);
  }

  async function handleToggleAi() {
    if (!settings) return;
    setTogglingAi(true);
    const endpoint = settings.enabled ? "/api/ai/settings/disable" : "/api/ai/settings/enable";
    const data = await apiFetch<AiSettings>(endpoint, { method: "POST" });
    if (data) setSettings(data);
    setTogglingAi(false);
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    const q = question.trim();
    setQuestion("");
    const data = await apiFetch<AiConversation>("/api/ai/ask", {
      method: "POST",
      body: JSON.stringify({ question: q }),
    });
    if (data) {
      setConversations((prev) => [...prev, data]);
    }
    setAsking(false);
  }

  async function handleGenerateOrgInsight() {
    setGeneratingOrg(true);
    const data = await apiFetch<AiInsight>("/api/ai/insights/org", { method: "POST" });
    if (data) {
      setOrgInsight(data);
      setRecentInsights((prev) => [data, ...prev]);
    }
    setGeneratingOrg(false);
  }

  const canAdmin = hasPermission("ai.admin");

  return (
    <div className="space-y-6">
      <PageHeader title="AI & Insights" subtitle="AI-powered fundraising intelligence">
        <div className="flex items-center gap-3">
          {settings && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                AI {settings.enabled ? "enabled" : "disabled"}
              </span>
              <Badge variant={settings.enabled ? "success" : "neutral"}>
                {settings.enabled ? "On" : "Off"}
              </Badge>
            </div>
          )}
          {canAdmin && settings && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleToggleAi}
              loading={togglingAi}
            >
              {settings.enabled ? "Disable AI" : "Enable AI"}
            </Button>
          )}
        </div>
      </PageHeader>

      {!settings?.enabled && (
        <Card>
          <div className="flex flex-col items-center py-12 text-center gap-4">
            <span className="text-4xl">🤖</span>
            <h3 className="text-lg font-semibold text-slate-800">AI is not enabled</h3>
            <p className="text-sm text-slate-500 max-w-md">
              AI-powered insights and the chat assistant are disabled for your organisation.
              {canAdmin
                ? " Use the toggle above to enable it."
                : " Ask your organisation admin to enable it in settings."}
            </p>
          </div>
        </Card>
      )}

      {settings?.enabled && (
        <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)}>
          <Tab value="chat" label="AI Chat" />
          <Tab value="org" label="Org Summary" />
          <Tab value="history" label="Insight History" />
        </Tabs>
      )}

      {settings?.enabled && tab === "chat" && (
        <div className="flex flex-col gap-4">
          <Card className="min-h-[420px] flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 p-4">
              {conversations.length === 0 && (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-slate-400">
                    Ask anything about your donors, campaigns, or fundraising performance.
                  </p>
                </div>
              )}
              {conversations.map((c) => (
                <div key={c.id} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="bg-emerald-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] text-sm">
                      {c.question}
                    </div>
                  </div>
                  {c.answer && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[75%] text-sm whitespace-pre-line">
                        {c.answer}
                        {c.model && (
                          <div className="mt-1 text-xs text-slate-400">{c.model}</div>
                        )}
                      </div>
                    </div>
                  )}
                  {c.status === "pending" && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                        <Spinner size="sm" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {asking && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <Spinner size="sm" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </Card>
          <form onSubmit={handleAsk} className="flex gap-3">
            <Input
              className="flex-1"
              placeholder="Ask Donorly AI anything…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={asking}
            />
            <Button type="submit" loading={asking} disabled={!question.trim()}>
              Send
            </Button>
          </form>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              "Which donors haven't been contacted in 30 days?",
              "How are we tracking against our campaign goals?",
              "What's the best time to reach out to donors?",
              "Summarise our fundraising performance this month",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setQuestion(prompt)}
                className="text-left text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {settings?.enabled && tab === "org" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleGenerateOrgInsight} loading={generatingOrg}>
              {orgInsight ? "Refresh insight" : "Generate insight"}
            </Button>
          </div>
          {orgInsight ? (
            <Card>
              <div className="flex items-start justify-between gap-4 mb-4">
                <h3 className="font-semibold text-slate-800">Organisation Summary</h3>
                <span className="text-xs text-slate-400 shrink-0">
                  {new Date(orgInsight.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                {orgInsight.insight}
              </div>
              {orgInsight.model && (
                <div className="mt-4 text-xs text-slate-400">Model: {orgInsight.model}</div>
              )}
            </Card>
          ) : (
            <EmptyState
              icon="🏢"
              title="No organisation insight yet"
              description="Click 'Generate insight' to get an AI-powered summary of your fundraising performance."
            />
          )}
        </div>
      )}

      {settings?.enabled && tab === "history" && (
        <div className="space-y-3">
          {recentInsights.length === 0 ? (
            <EmptyState
              icon="📊"
              title="No insights generated yet"
              description="Insights appear here after you generate them from the Org Summary tab or from donor / campaign pages."
            />
          ) : (
            recentInsights.map((ins) => (
              <Card key={ins.id}>
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant={ins.entityType === "org" ? "primary" : ins.entityType === "campaign" ? "warning" : "info"}>
                    {ins.entityType}
                  </Badge>
                  <span className="text-xs text-slate-400 ml-auto">
                    {new Date(ins.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-line line-clamp-4">
                  {ins.insight}
                </p>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

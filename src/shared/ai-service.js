/**
 * AI Service Layer for Clustr
 *
 * Supports multiple AI providers:
 * - Chrome AI (Gemini Nano) - Free, local, requires Chrome 138+
 * - OpenAI - GPT-4, requires API key
 * - Anthropic - Claude, requires API key
 */

const SYSTEM_PROMPT = `You are a helpful browser assistant integrated into the Clustr tab manager extension. You help users organize their tabs, manage browser sessions, and work more efficiently.

You have access to the user's current browser state including:
- Open tabs and windows
- Saved sessions
- Bookmarks (if permitted)

You can help users by:
- Suggesting ways to organize their tabs
- Finding specific tabs by title or URL
- Helping them save and restore sessions
- Answering questions about their open tabs

When the user asks you to perform an action, respond with a JSON action block that the extension will execute. Available actions:

1. Close tabs:
   { "action": "closeTabs", "tabIds": [1, 2, 3] }

2. Save current tabs as session:
   { "action": "saveSession", "name": "Session Name" }

3. Focus a tab:
   { "action": "focusTab", "tabId": 123 }

4. Search tabs (returns results to show user):
   { "action": "searchTabs", "query": "search term" }

5. Group tabs by domain:
   { "action": "groupByDomain" }

6. Create a new window with URLs:
   { "action": "createWindow", "urls": ["https://example.com", "https://other.com"] }

7. Move existing tabs to a new window:
   { "action": "moveTabsToWindow", "tabIds": [1, 2, 3] }

Always be concise and helpful. When listing tabs, show title and URL. Format numbers and counts clearly.`;

/**
 * Check if Chrome's built-in AI is available
 */
export async function checkChromeAIAvailable() {
  try {
    if (typeof ai === 'undefined' || !ai.languageModel) {
      return { available: false, reason: 'Chrome AI API not found. Requires Chrome 138+ with flags enabled.' };
    }

    const capabilities = await ai.languageModel.capabilities();
    if (capabilities.available === 'no') {
      return { available: false, reason: 'Gemini Nano model not available on this device.' };
    }
    if (capabilities.available === 'after-download') {
      return { available: false, reason: 'Gemini Nano model needs to be downloaded. Visit chrome://components and update "Optimization Guide On Device Model".' };
    }

    return { available: true, capabilities };
  } catch (error) {
    return { available: false, reason: `Chrome AI check failed: ${error.message}` };
  }
}

/**
 * Build context string from browser state
 */
function buildContextString(context) {
  const parts = [];

  if (context.tabs && context.tabs.length > 0) {
    parts.push(`\n## Current Tabs (${context.tabs.length} total)`);

    // Group tabs by window
    const windowMap = new Map();
    for (const tab of context.tabs) {
      const windowId = tab.windowId || 'unknown';
      if (!windowMap.has(windowId)) {
        windowMap.set(windowId, []);
      }
      windowMap.get(windowId).push(tab);
    }

    let windowNum = 1;
    for (const [windowId, tabs] of windowMap) {
      parts.push(`\nWindow ${windowNum} (${tabs.length} tabs):`);
      for (const tab of tabs.slice(0, 20)) { // Limit to 20 per window
        const active = tab.active ? ' [ACTIVE]' : '';
        parts.push(`- [${tab.id}] ${tab.title}${active}`);
        parts.push(`  ${tab.url}`);
      }
      if (tabs.length > 20) {
        parts.push(`  ... and ${tabs.length - 20} more tabs`);
      }
      windowNum++;
    }
  }

  if (context.sessions && context.sessions.length > 0) {
    parts.push(`\n## Saved Sessions (${context.sessions.length})`);
    for (const session of context.sessions.slice(0, 10)) {
      parts.push(`- ${session.name} (${session.tabs?.length || 0} tabs)`);
    }
  }

  if (context.bookmarks && context.bookmarks.length > 0) {
    parts.push(`\n## Bookmarks (${context.bookmarks.length} folders)`);
    // Just show folder structure, not all bookmarks
    for (const folder of context.bookmarks.slice(0, 5)) {
      if (folder.title) {
        parts.push(`- ${folder.title}`);
      }
    }
  }

  return parts.join('\n');
}

/**
 * AI Service class supporting multiple providers
 */
export class AIService {
  constructor(config = {}) {
    this.provider = config.provider || 'chrome-ai';
    this.apiKey = config.apiKey || '';
    this.model = config.model || this.getDefaultModel();
    this.session = null; // Chrome AI session
  }

  getDefaultModel() {
    switch (this.provider) {
      case 'openai':
        return 'gpt-4o-mini';
      case 'anthropic':
        return 'claude-3-5-haiku-latest';
      default:
        return 'gemini-nano';
    }
  }

  /**
   * Check if the current provider is available
   */
  async isAvailable() {
    if (this.provider === 'chrome-ai') {
      return await checkChromeAIAvailable();
    }

    if (this.provider === 'openai' || this.provider === 'anthropic') {
      if (!this.apiKey) {
        return { available: false, reason: `${this.provider} requires an API key.` };
      }
      return { available: true };
    }

    return { available: false, reason: 'Unknown provider.' };
  }

  /**
   * Send a chat message and get a response
   */
  async chat(userMessage, context = {}) {
    const contextString = buildContextString(context);
    const fullSystemPrompt = SYSTEM_PROMPT + contextString;

    if (this.provider === 'chrome-ai') {
      return await this.chatWithChromeAI(fullSystemPrompt, userMessage);
    } else if (this.provider === 'openai') {
      return await this.chatWithOpenAI(fullSystemPrompt, userMessage);
    } else if (this.provider === 'anthropic') {
      return await this.chatWithAnthropic(fullSystemPrompt, userMessage);
    }

    throw new Error('Unknown AI provider: ' + this.provider);
  }

  /**
   * Chat using Chrome's built-in AI (Gemini Nano)
   */
  async chatWithChromeAI(systemPrompt, userMessage) {
    try {
      // Create a new session with the system prompt
      // Chrome AI doesn't maintain conversation history well, so we create fresh sessions
      const session = await ai.languageModel.create({
        systemPrompt: systemPrompt
      });

      const response = await session.prompt(userMessage);
      session.destroy(); // Clean up session

      return {
        content: response,
        provider: 'chrome-ai',
        model: 'gemini-nano'
      };
    } catch (error) {
      throw new Error(`Chrome AI error: ${error.message}`);
    }
  }

  /**
   * Chat using OpenAI API
   */
  async chatWithOpenAI(systemPrompt, userMessage) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
      }

      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        provider: 'openai',
        model: this.model,
        usage: data.usage
      };
    } catch (error) {
      throw new Error(`OpenAI error: ${error.message}`);
    }
  }

  /**
   * Chat using Anthropic API
   */
  async chatWithAnthropic(systemPrompt, userMessage) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userMessage }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Anthropic API request failed');
      }

      const data = await response.json();
      return {
        content: data.content[0].text,
        provider: 'anthropic',
        model: this.model,
        usage: data.usage
      };
    } catch (error) {
      throw new Error(`Anthropic error: ${error.message}`);
    }
  }

  /**
   * Parse AI response for action commands
   */
  parseActions(response) {
    const actions = [];
    const content = response.content || response;

    // Look for JSON action blocks in the response
    const jsonRegex = /\{[\s\S]*?"action"[\s\S]*?\}/g;
    const matches = content.match(jsonRegex);

    if (matches) {
      for (const match of matches) {
        try {
          const action = JSON.parse(match);
          if (action.action) {
            actions.push(action);
          }
        } catch (e) {
          // Not valid JSON, skip
        }
      }
    }

    return actions;
  }
}

/**
 * Execute an AI action
 */
export async function executeAction(action) {
  switch (action.action) {
    case 'closeTabs':
      if (action.tabIds && Array.isArray(action.tabIds)) {
        for (const tabId of action.tabIds) {
          try {
            await chrome.tabs.remove(tabId);
          } catch (e) {
            console.error(`Failed to close tab ${tabId}:`, e);
          }
        }
        return { success: true, message: `Closed ${action.tabIds.length} tab(s)` };
      }
      break;

    case 'focusTab':
      if (action.tabId) {
        const tab = await chrome.tabs.get(action.tabId);
        await chrome.windows.update(tab.windowId, { focused: true });
        await chrome.tabs.update(action.tabId, { active: true });
        return { success: true, message: 'Tab focused' };
      }
      break;

    case 'saveSession':
      if (action.name) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const sessionTabs = tabs.map(t => ({
          title: t.title,
          url: t.url,
          favIconUrl: t.favIconUrl
        }));

        // Send to service worker to save
        await chrome.runtime.sendMessage({
          action: 'saveSession',
          name: action.name,
          tabs: sessionTabs
        });
        return { success: true, message: `Session "${action.name}" saved` };
      }
      break;

    case 'searchTabs':
      if (action.query) {
        const allTabs = await chrome.tabs.query({});
        const query = action.query.toLowerCase();
        const matches = allTabs.filter(t =>
          t.title?.toLowerCase().includes(query) ||
          t.url?.toLowerCase().includes(query)
        );
        return { success: true, tabs: matches };
      }
      break;

    case 'createWindow':
      try {
        const urls = action.tabs || action.urls || [];
        if (urls.length === 0) {
          return { success: false, message: 'No URLs provided for new window' };
        }
        const newWindow = await chrome.windows.create({ url: urls });
        return { success: true, message: `Created new window with ${urls.length} tab(s)` };
      } catch (e) {
        return { success: false, message: `Failed to create window: ${e.message}` };
      }

    case 'moveTabsToWindow':
      try {
        const tabIds = action.tabIds || [];
        if (tabIds.length === 0) {
          return { success: false, message: 'No tabs specified to move' };
        }
        const newWindow = await chrome.windows.create({ tabId: tabIds[0] });
        // Move remaining tabs to the new window
        for (let i = 1; i < tabIds.length; i++) {
          await chrome.tabs.move(tabIds[i], { windowId: newWindow.id, index: -1 });
        }
        return { success: true, message: `Moved ${tabIds.length} tab(s) to new window` };
      } catch (e) {
        return { success: false, message: `Failed to move tabs: ${e.message}` };
      }

    case 'groupByDomain':
      try {
        const allTabs = await chrome.tabs.query({ currentWindow: true });

        // Group tabs by domain
        const domainMap = new Map();
        for (const tab of allTabs) {
          try {
            const url = new URL(tab.url);
            const domain = url.hostname.replace('www.', '');
            if (!domainMap.has(domain)) {
              domainMap.set(domain, []);
            }
            domainMap.get(domain).push(tab.id);
          } catch (e) {
            // Skip tabs with invalid URLs (like chrome:// pages)
          }
        }

        // Create tab groups for domains with 2+ tabs
        let groupsCreated = 0;
        const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
        let colorIndex = 0;

        for (const [domain, tabIds] of domainMap) {
          if (tabIds.length >= 2) {
            const groupId = await chrome.tabs.group({ tabIds });
            await chrome.tabGroups.update(groupId, {
              title: domain.split('.')[0], // Use first part of domain as title
              color: colors[colorIndex % colors.length],
              collapsed: false
            });
            groupsCreated++;
            colorIndex++;
          }
        }

        return { success: true, message: `Created ${groupsCreated} tab group(s)` };
      } catch (e) {
        return { success: false, message: `Tab grouping failed: ${e.message}` };
      }

    default:
      return { success: false, message: `Unknown action: ${action.action}` };
  }

  return { success: false, message: 'Action failed' };
}

export default AIService;

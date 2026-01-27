

# AI Help Chat for the Help Center

This plan adds an AI-powered help assistant to the existing Help Center page, allowing users to ask questions about using Ride Ready Docs and get instant answers. The AI will be trained on the app's documentation, FAQs, and feature guides.

---

## Overview

The AI help chat will be integrated directly into the Help Center page (`/help`), positioned prominently so users can quickly get answers without scrolling through FAQs. The assistant will understand the app's terminology, features, and UK fairground industry context.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Help Center Page                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AI Help Chat Card                      │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │  Message History (scrollable)                     │    │   │
│  │  │  - User: How do I upload documents?               │    │   │
│  │  │  - AI: To upload documents, go to your ride...    │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │  [Type your question...]           [Send]         │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Existing Quick Start Guides...]                                │
│  [Existing FAQs...]                                              │
│  [Contact Support Section...]                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### 1. Create Help Chat Edge Function

**File:** `supabase/functions/help-chat/index.ts`

This edge function will:
- Use Lovable AI (`google/gemini-3-flash-preview`) for fast, accurate responses
- Include a comprehensive system prompt with all app documentation
- Support streaming for a responsive UX
- Handle rate limiting (402/429 errors) gracefully
- Log conversations for quality improvement

The system prompt will contain:
- All FAQ content from the Help Center
- Feature descriptions and step-by-step guides
- Pricing information and plan differences
- UK fairground industry terminology
- Instructions to escalate complex issues to human support

### 2. Create HelpChatWidget Component

**File:** `src/components/HelpChatWidget.tsx`

A reusable chat component featuring:
- **Message history** with user/assistant distinction
- **Streaming responses** rendered token-by-token with markdown support
- **Suggested questions** to help users get started
- **Loading states** and error handling
- **"Contact Support" escalation** button
- **Clear chat** option

### 3. Integrate into Help Center

**File:** `src/pages/HelpCenter.tsx` (modified)

Add the AI chat section prominently:
- Position between the hero section and Quick Start Guides
- Full-width card with gradient border matching existing design
- Mobile-responsive layout

### 4. Update supabase/config.toml

Add the new edge function configuration:
```toml
[functions.help-chat]
verify_jwt = false
```

---

## Technical Details

### System Prompt Strategy

The AI will be given context about:
- **Features**: Overview, Rides, Calendar, Documents, Checks, Maintenance, Risk Assessments
- **Plans**: Documents & Compliance (basic) vs Operations & Maintenance (advanced)
- **Terminology**: UK showman terminology, ride categories, document types
- **Limitations**: What requires human support (billing issues, bugs, account problems)

### Suggested Starting Questions

The chat will show clickable suggestions:
- "How do I add my first ride?"
- "What documents should I upload?"
- "How do daily checks work?"
- "What's included in my plan?"
- "How do I schedule inspections?"

### Rate Limiting

- Uses the existing rate limit infrastructure from `_shared/rate-limit.ts`
- Moderate limits suitable for help queries
- Graceful error messages when limits exceeded

### Markdown Rendering

AI responses will be rendered with `react-markdown` for:
- Formatted lists and steps
- Bold/italic text for emphasis
- Code formatting where relevant
- Links to relevant pages

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/help-chat/index.ts` | Create | Edge function for AI chat with streaming |
| `src/components/HelpChatWidget.tsx` | Create | React component for the chat interface |
| `src/pages/HelpCenter.tsx` | Modify | Integrate chat widget into the page |
| `supabase/config.toml` | Modify | Add function configuration |

---

## User Experience Flow

1. User visits `/help` (Help Center)
2. AI chat card is prominently displayed with suggested questions
3. User types a question or clicks a suggestion
4. AI streams a response with markdown formatting
5. User can continue the conversation or ask new questions
6. If AI can't help, it suggests contacting support with a button
7. Conversation resets on page reload (no persistence needed)

---

## Security Considerations

- No authentication required (public help content)
- Rate limiting prevents abuse
- IP blocking for suspicious activity
- System prompt prevents off-topic usage
- No sensitive data exposed through the chat

